import { Inject, Injectable } from '@nestjs/common';
import { percentOf, type MilestoneBar, type MissionSummaryDto } from '@sigpro/shared';
import { ENV, type Env } from '../config/env';
import { NcService } from '../nc/nc.service';
import { PrismaService } from '../prisma/prisma.service';
import { MissionEventsService } from './mission-events.service';

const CHART_PROGRAMS = 8;

@Injectable()
export class MissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nc: NcService,
    private readonly events: MissionEventsService,
    @Inject(ENV) private readonly env: Pick<Env, 'SIMULATOR_MS'>,
  ) {}

  /** Último resultado de cada caso de prueba: % de casos con ejecuciones cuyo último resultado es «superado». */
  private async verification(tenantId: string): Promise<{ pass: number; casesWithRuns: number }> {
    const runs = await this.prisma.testRun.findMany({ where: { tenantId }, orderBy: [{ executedAt: 'desc' }, { id: 'desc' }], select: { testCaseCode: true, result: true } });
    const lastByCase = new Map<string, string>();
    runs.forEach((run) => lastByCase.has(run.testCaseCode) || lastByCase.set(run.testCaseCode, run.result));
    const passed = Array.from(lastByCase.values()).filter((result) => result === 'pass').length;
    return { pass: percentOf(passed, lastByCase.size), casesWithRuns: lastByCase.size };
  }

  async summary(tenantId: string): Promise<MissionSummaryDto> {
    const [programs, milestones, ncTotal, openCounts, verification] = await Promise.all([
      this.prisma.program.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { code: true, name: true, status: true } }),
      this.prisma.milestone.findMany({ where: { tenantId }, select: { programCode: true, done: true } }),
      this.prisma.nonConformity.count({ where: { tenantId } }),
      this.nc.openCounts(tenantId),
      this.verification(tenantId),
    ]);

    const byProgram = new Map<string, { done: number; total: number }>();
    milestones.forEach((m) => {
      const current = byProgram.get(m.programCode) ?? { done: 0, total: 0 };
      byProgram.set(m.programCode, { done: current.done + (m.done ? 1 : 0), total: current.total + 1 });
    });
    const milestonesByProgram: readonly MilestoneBar[] = programs
      .filter((program) => program.status === 'active' && byProgram.has(program.code))
      .slice(0, CHART_PROGRAMS)
      .map((program) => ({ programCode: program.code, programName: program.name, ...(byProgram.get(program.code) as { done: number; total: number }) }));

    return {
      kpis: {
        activePrograms: programs.filter((program) => program.status === 'active').length,
        programsTotal: programs.length,
        programsProgress: percentOf(
          programs.reduce((sum, program) => {
            const milestones = byProgram.get(program.code);
            return sum + (milestones ? percentOf(milestones.done, milestones.total) : 0);
          }, 0),
          programs.length * 100,
        ),
        milestonesDone: milestones.filter((m) => m.done).length,
        milestonesTotal: milestones.length,
        ncOpen: openCounts.ncOpen,
        ncTotal,
        verificationPass: verification.pass,
        casesWithRuns: verification.casesWithRuns,
      },
      milestonesByProgram,
      ncBySeverity: openCounts.ncBySeverity,
      recent: this.events.recent(tenantId, 20),
      simulatorMs: this.env.SIMULATOR_MS,
    };
  }

  /** Programas activos del tenant (para que el simulador hable de programas que existen). */
  async activeProgramCodes(tenantId: string): Promise<readonly string[]> {
    const rows = await this.prisma.program.findMany({ where: { tenantId, status: 'active' }, orderBy: { code: 'asc' }, take: 12, select: { code: true } });
    return rows.map((row) => row.code);
  }
}
