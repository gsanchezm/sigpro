import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  can,
  descendantCodes,
  moveInOrder,
  nextRequirementCode,
  transitionRule,
  type CreateRequirementInput,
  type MoveRequirementInput,
  type RequirementDto,
  type RequirementListResponse,
  type RequirementState,
  type TraceabilityDto,
  type UpdateRequirementInput,
} from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { lockTenantCodes } from '../common/tenant-lock';
import { PrismaService } from '../prisma/prisma.service';
import { summarizeRuns } from '../verification/test-case-query';
import { WITH_TESTS, toRequirementDto, type RequirementRow } from './requirement-dto';

const invalid = (field: string, key: string) => fail.unprocessable('validation_failed', 'validation_failed', { [field]: key });

@Injectable()
export class RequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async program(tenantId: string, code: string): Promise<{ code: string; name: string }> {
    const program = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { code: true, name: true } });
    if (!program) throw fail.notFound('program_not_found', 'program_not_found');
    return program;
  }

  private async row(tenantId: string, code: string): Promise<RequirementRow> {
    const row = await this.prisma.requirement.findUnique({ where: { tenantId_code: { tenantId, code } }, include: WITH_TESTS });
    if (!row) throw fail.notFound('requirement_not_found', 'requirement_not_found');
    return row;
  }

  async list(tenantId: string, programCode: string): Promise<RequirementListResponse> {
    const program = await this.program(tenantId, programCode);
    const rows = await this.prisma.requirement.findMany({ where: { tenantId, programCode }, include: WITH_TESTS, orderBy: { code: 'asc' } });
    return { program, items: rows.map(toRequirementDto) };
  }

  async get(tenantId: string, code: string): Promise<RequirementDto> {
    return toRequirementDto(await this.row(tenantId, code));
  }

  async traceability(tenantId: string, programCode: string): Promise<TraceabilityDto> {
    await this.program(tenantId, programCode);
    const [requirements, testCases, links] = await Promise.all([
      this.prisma.requirement.findMany({ where: { tenantId, programCode }, orderBy: { code: 'asc' }, select: { code: true, title: true, state: true } }),
      this.prisma.testCase.findMany({ where: { tenantId, programCode }, orderBy: { code: 'asc' }, select: { code: true, title: true, runs: { select: { id: true, executedAt: true, result: true } } } }),
      this.prisma.requirementTestCase.findMany({ where: { tenantId, requirement: { programCode } }, select: { requirementCode: true, testCaseCode: true }, orderBy: [{ requirementCode: 'asc' }, { testCaseCode: 'asc' }] }),
    ]);
    // Cada columna de la matriz lleva el resultado de la última ejecución de su caso (✓ / ✕ / · en la web)
    return { requirements, testCases: testCases.map(({ runs, ...testCase }) => ({ ...testCase, lastResult: summarizeRuns(runs).lastResult })), links };
  }

  /** Alta en borrador, al final de sus hermanos. El padre debe ser del mismo programa. */
  async create(user: AuthUser, input: CreateRequirementInput): Promise<RequirementDto> {
    const { tenantId } = user;
    await this.program(tenantId, input.programCode);
    if (input.parentCode) {
      const parent = await this.prisma.requirement.findUnique({ where: { tenantId_code: { tenantId, code: input.parentCode } }, select: { programCode: true } });
      if (!parent || parent.programCode !== input.programCode) throw invalid('parentCode', 'badParent');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await lockTenantCodes(tx, tenantId);
      const codes = (await tx.requirement.findMany({ where: { tenantId }, select: { code: true } })).map((r) => r.code);
      const code = nextRequirementCode(codes);
      const position = await tx.requirement.count({ where: { tenantId, programCode: input.programCode, parentCode: input.parentCode } });
      const row = await tx.requirement.create({
        data: {
          tenantId,
          code,
          programCode: input.programCode,
          parentCode: input.parentCode,
          title: input.title,
          description: input.description,
          priority: input.priority,
          tags: [...input.tags],
          state: 'draft',
          position,
        },
        include: WITH_TESTS,
      });
      await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.created', entity: 'requirement', entityId: code, diff: { title: input.title, parent: input.parentCode } }, tx);
      return row;
    });
    return toRequirementDto(created);
  }

  /** Editar el título o la descripción devuelve el requisito a `draft` (regla del plan); etiquetas y prioridad no. */
  async update(user: AuthUser, code: string, input: UpdateRequirementInput): Promise<RequirementDto> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    const textChanged = (input.title !== undefined && input.title !== current.title) || (input.description !== undefined && input.description !== current.description);
    const reverted = textChanged && current.state !== 'draft';

    const changed = (['title', 'description', 'priority', 'tags'] as const).filter((field) => {
      const next = input[field];
      return next !== undefined && JSON.stringify(next) !== JSON.stringify(current[field]);
    });
    const data: Prisma.RequirementUncheckedUpdateInput = {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
      ...(reverted ? { state: 'draft' as const } : {}),
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.requirement.update({ where: { tenantId_code: { tenantId, code } }, data, include: WITH_TESTS });
      await this.audit.record(
        { tenantId, actorId: user.id, action: 'requirement.updated', entity: 'requirement', entityId: code, diff: { fields: [...changed], ...(reverted ? { revertedFrom: current.state } : {}) } },
        tx,
      );
      return updated;
    });
    return toRequirementDto(row);
  }

  /** Pasos de la máquina de estados; el permiso depende del paso (aprobar, verificar, validar, volver a borrador). */
  async transition(user: AuthUser, code: string, to: RequirementState): Promise<RequirementDto> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    const rule = transitionRule(current.state, to);
    if (!rule) throw fail.conflict('invalid_transition', 'invalid_transition');
    if (!can(user.role, rule.permission)) throw fail.forbidden('forbidden', 'forbidden');

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.requirement.update({ where: { tenantId_code: { tenantId, code } }, data: { state: to }, include: WITH_TESTS });
      await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.state_changed', entity: 'requirement', entityId: code, diff: { from: current.state, to } }, tx);
      return updated;
    });
    return toRequirementDto(row);
  }

  /** Reordena entre hermanos (mismo programa y mismo padre) y renumera sus posiciones. */
  async move(user: AuthUser, code: string, input: MoveRequirementInput): Promise<RequirementListResponse> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    const target = await this.prisma.requirement.findUnique({ where: { tenantId_code: { tenantId, code: input.targetCode } }, select: { programCode: true, parentCode: true } });
    if (!target || target.programCode !== current.programCode || target.parentCode !== current.parentCode) throw invalid('targetCode', 'badTarget');

    const siblings = await this.prisma.requirement.findMany({
      where: { tenantId, programCode: current.programCode, parentCode: current.parentCode },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
      select: { code: true, position: true },
    });
    const order = moveInOrder(siblings.map((s) => s.code), code, input.targetCode, input.placement);
    if (!order) throw invalid('targetCode', 'badTarget');

    // Solo se reescriben las posiciones que cambian (las guardadas pueden tener huecos tras eliminar requisitos)
    const stored = new Map(siblings.map((s) => [s.code, s.position]));
    await this.prisma.$transaction(async (tx) => {
      for (const [position, sibling] of order.entries()) {
        if (stored.get(sibling) !== position) await tx.requirement.update({ where: { tenantId_code: { tenantId, code: sibling } }, data: { position } });
      }
      await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.moved', entity: 'requirement', entityId: code, diff: { target: input.targetCode, placement: input.placement } }, tx);
    });
    return this.list(tenantId, current.programCode);
  }

  /** Elimina el requisito y todos sus descendientes (y sus enlaces con casos de prueba, por cascada). */
  async remove(user: AuthUser, code: string): Promise<void> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    const all = await this.prisma.requirement.findMany({ where: { tenantId, programCode: current.programCode }, select: { code: true, parentCode: true } });
    const descendants = descendantCodes(all.map((r) => ({ ...r, position: 0 })), code);
    await this.prisma.$transaction(async (tx) => {
      await tx.requirement.deleteMany({ where: { tenantId, code: { in: [code, ...descendants] } } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.deleted', entity: 'requirement', entityId: code, diff: { descendants: descendants.length } }, tx);
    });
  }

  /** Enlaza el requisito con un caso de prueba del mismo programa (idempotente). */
  async link(user: AuthUser, code: string, testCaseCode: string): Promise<void> {
    const { tenantId } = user;
    const requirement = await this.row(tenantId, code);
    const testCase = await this.prisma.testCase.findUnique({ where: { tenantId_code: { tenantId, code: testCaseCode } }, select: { programCode: true } });
    if (!testCase) throw fail.notFound('test_case_not_found', 'test_case_not_found');
    if (testCase.programCode !== requirement.programCode) throw invalid('testCaseCode', 'differentProgram');

    const exists = await this.prisma.requirementTestCase.findUnique({ where: { tenantId_requirementCode_testCaseCode: { tenantId, requirementCode: code, testCaseCode } } });
    if (exists) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.requirementTestCase.create({ data: { tenantId, requirementCode: code, testCaseCode } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.linked', entity: 'requirement', entityId: code, diff: { testCase: testCaseCode } }, tx);
    });
  }

  async unlink(user: AuthUser, code: string, testCaseCode: string): Promise<void> {
    const { tenantId } = user;
    await this.row(tenantId, code);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.requirementTestCase.deleteMany({ where: { tenantId, requirementCode: code, testCaseCode } });
      if (count > 0) await this.audit.record({ tenantId, actorId: user.id, action: 'requirement.unlinked', entity: 'requirement', entityId: code, diff: { testCase: testCaseCode } }, tx);
    });
  }
}
