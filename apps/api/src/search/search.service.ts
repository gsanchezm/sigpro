import { Injectable } from '@nestjs/common';
import { can, type SearchResponse } from '@sigpro/shared';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { buildGroups, documentEntry, matchEntries, ncEntry, normalizeQuery, programEntry, requirementEntry, testCaseEntry } from './search-groups';

/**
 * Búsqueda global agrupada. Cada tenant tiene pocos registros (24 programas, 40 requisitos, 25 casos, 12 NC, 12 documentos),
 * así que se traen los campos mínimos del tenant y se busca en memoria sobre texto plano: así una descripción en HTML
 * no coincide con sus propias etiquetas. Los documentos `restricted` solo los ven los roles con `document.viewRestricted`.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: AuthUser, rawQuery: string | undefined): Promise<SearchResponse> {
    const query = normalizeQuery(rawQuery);
    if (!query) throw fail.unprocessable('validation_failed', 'validation_failed', { q: 'minChars' });
    const { tenantId } = user;
    const classification = can(user.role, 'document.viewRestricted') ? {} : { classification: 'public' as const };

    const [programs, requirements, testCases, ncs, documents] = await Promise.all([
      this.prisma.program.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { code: true, name: true, description: true, owner: { select: { name: true } } } }),
      this.prisma.requirement.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { code: true, programCode: true, title: true, description: true } }),
      this.prisma.testCase.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { code: true, programCode: true, title: true } }),
      this.prisma.nonConformity.findMany({ where: { tenantId }, orderBy: { code: 'asc' }, select: { code: true, programCode: true, description: true } }),
      this.prisma.document.findMany({ where: { tenantId, ...classification }, orderBy: { id: 'asc' }, select: { id: true, programCode: true, title: true } }),
    ]);

    return {
      query,
      groups: buildGroups({
        program: matchEntries(query, programs.map(programEntry)),
        requirement: matchEntries(query, requirements.map(requirementEntry)),
        testcase: matchEntries(query, testCases.map(testCaseEntry)),
        nc: matchEntries(query, ncs.map(ncEntry)),
        document: matchEntries(query, documents.map(documentEntry)),
      }),
    };
  }
}
