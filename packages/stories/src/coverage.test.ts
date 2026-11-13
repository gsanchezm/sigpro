import { describe, expect, it } from 'vitest';
import { buildCoverage, extractEndpoints, extractWebRoutes, holes, mobileRoutesFromFiles, renderCoverageMarkdown, summarizeHoles, type Coverage } from './coverage';
import type { PlatformLabel, StoryFile } from './model';

const ADMIN_CONTROLLER = `
import { Controller, Post } from '@nestjs/common';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  @Post('reset')
  @ApiOperation({ summary: 'Restaura el seed' })
  reset() {}
}
`;

const MILESTONES_CONTROLLER = `
@Controller()
export class MilestonesController {
  @Get('programs/:code/milestones')
  list() {}

  @Delete('milestones/:id')
  remove() {}
}
`;

const AUDIT_CONTROLLER = `
@Controller('audit')
export class AuditController {
  @Get()
  list() {}
}
`;

describe('extractEndpoints', () => {
  it('antepone /api y el prefijo del controlador a la ruta del método', () => {
    expect(extractEndpoints([ADMIN_CONTROLLER])).toEqual(['POST /api/admin/reset']);
  });

  it('un @Controller() sin prefijo deja la ruta absoluta del método bajo /api', () => {
    expect(extractEndpoints([MILESTONES_CONTROLLER])).toEqual(['GET /api/programs/:code/milestones', 'DELETE /api/milestones/:id']);
  });

  it('un método sin argumento (@Get()) es la raíz del controlador', () => {
    expect(extractEndpoints([AUDIT_CONTROLLER])).toEqual(['GET /api/audit']);
  });

  it('recorre los controladores en el orden dado y cada método con el prefijo de su clase', () => {
    expect(extractEndpoints([ADMIN_CONTROLLER, AUDIT_CONTROLLER, MILESTONES_CONTROLLER])).toEqual([
      'POST /api/admin/reset',
      'GET /api/audit',
      'GET /api/programs/:code/milestones',
      'DELETE /api/milestones/:id',
    ]);
  });

  it('un archivo con dos controladores usa el prefijo del más cercano por encima', () => {
    const text = `@Controller('a') class A { @Get('x') x() {} }\n@Controller('b') class B { @Put('y') y() {} }`;
    expect(extractEndpoints([text])).toEqual(['GET /api/a/x', 'PUT /api/b/y']);
  });

  it('reconoce los cinco verbos, comillas dobles y el decorador partido en varias líneas', () => {
    const text = `@Controller("things")
export class ThingsController {
  @Get(
    ':id',
  )
  one() {}
  @Patch(":id") patch() {}
  @Put(':id/tests/:testCaseCode') put() {}
  @Delete(':id') remove() {}
  @Post() create() {}
}`;
    expect(extractEndpoints([text])).toEqual([
      'GET /api/things/:id',
      'PATCH /api/things/:id',
      'PUT /api/things/:id/tests/:testCaseCode',
      'DELETE /api/things/:id',
      'POST /api/things',
    ]);
  });

  it('normaliza barras sobrantes al unir prefijo y ruta', () => {
    expect(extractEndpoints([`@Controller('/x/') class X { @Get('/y/') y() {} }`])).toEqual(['GET /api/x/y']);
  });

  it('no confunde otros decoradores (@ApiOperation, @UseGuards…) con verbos', () => {
    const text = `@Controller('x') class X { @UseGuards(AuthGuard) @ApiOperation({ summary: 'Get(x)' }) @Get('y') y() {} }`;
    expect(extractEndpoints([text])).toEqual(['GET /api/x/y']);
  });

  it('no deduplica: cada decorador es un endpoint, para poder compararlo con el recuento en disco', () => {
    const text = `@Controller('x') class X { @Get('y') a() {} @Get('y') b() {} }`;
    expect(extractEndpoints([text])).toEqual(['GET /api/x/y', 'GET /api/x/y']);
  });

  it('sin controladores devuelve una lista vacía', () => {
    expect(extractEndpoints([])).toEqual([]);
    expect(extractEndpoints(['export const x = 1;'])).toEqual([]);
  });
});

const APP_TSX = `
<Routes>
  <Route path="/" element={<Navigate to="/programs" replace />} />
  <Route
    path="/login"
    element={
      <PublicOnly>
        <AccessPage routeView="login" />
      </PublicOnly>
    }
  />
  <Route path="/lab" element={<LabRoute />} />
  <Route path="/legal/terms" element={<LegalPage kind="terms" />} />
  <Route element={<RequireAuth />}>
    {/* Visor HTML de documentos */}
    <Route path="/documents/:id/view" element={<DocumentViewerPage />} />
    <Route element={<AppShell />}>
      <Route path="/programs" element={<ProgramsPage />} />
      <Route path="/programs/:code" element={<ProgramDetailPage />} />
    </Route>
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
`;

describe('extractWebRoutes', () => {
  it('devuelve las rutas absolutas en orden y excluye /, * y /lab', () => {
    expect(extractWebRoutes(APP_TSX)).toEqual(['/login', '/legal/terms', '/documents/:id/view', '/programs', '/programs/:code']);
  });

  it('las rutas de diseño sin path (layout) no aportan nada', () => {
    expect(extractWebRoutes(`<Route element={<RequireAuth />}><Route element={<AppShell />} /></Route>`)).toEqual([]);
  });

  it('reconoce el path aunque vaya detrás de element y con comillas simples', () => {
    expect(extractWebRoutes(`<Route element={<A to="/no" />} path='/nc/:code' />`)).toEqual(['/nc/:code']);
  });

  it('un path dentro del element (de otro componente) no es una ruta', () => {
    expect(extractWebRoutes(`<Route path="/a" element={<Link path="/b" />} />`)).toEqual(['/a']);
  });

  it('sin rutas devuelve una lista vacía', () => {
    expect(extractWebRoutes('export const x = 1;')).toEqual([]);
  });
});

describe('mobileRoutesFromFiles', () => {
  it('quita grupos, convierte [param] en :param y trata index como la carpeta; excluye / y _layout', () => {
    expect(
      mobileRoutesFromFiles(['(app)/programs/[code]/index.tsx', '(app)/(more)/admin.tsx', 'index.tsx', '_layout.tsx', 'legal/privacy.tsx']),
    ).toEqual(['/programs/:code', '/admin', '/legal/privacy']);
  });

  it('acepta rutas de Windows con barras invertidas y un ./ inicial', () => {
    expect(mobileRoutesFromFiles(['(app)\\programs\\[code]\\edit.tsx', '.\\login.tsx', './help.tsx'])).toEqual(['/programs/:code/edit', '/login', '/help']);
  });

  it('un _layout anidado y un index de grupo no son rutas', () => {
    expect(mobileRoutesFromFiles(['(app)/_layout.tsx', '(app)/(more)/documents/_layout.tsx', '(app)/index.tsx'])).toEqual([]);
  });

  it('ignora lo que no es un módulo de ruta (+not-found, estilos, carpetas sin extensión)', () => {
    expect(mobileRoutesFromFiles(['+not-found.tsx', 'login.css', '(app)', 'login.tsx'])).toEqual(['/login']);
  });

  it('dos archivos que dan la misma ruta cuentan una vez', () => {
    expect(mobileRoutesFromFiles(['(a)/x.tsx', '(b)/x.tsx'])).toEqual(['/x']);
  });
});

const story = (id: string, label: PlatformLabel, extra: { cubre?: readonly string[]; permisos?: readonly string[] } = {}): StoryFile => ({
  kind: 'story',
  path: `docs/user-stories/${id}.md`,
  body: '',
  fm: {
    id,
    tipo: 'historia',
    epica: 'EP-LOGIN',
    titulo: `Historia ${id}`,
    etiquetas: [label],
    verificacion: 'ejecutada',
    cubre: extra.cubre === undefined ? undefined : [...extra.cubre],
    permisos: extra.permisos === undefined ? undefined : [...extra.permisos],
  },
});

const SOURCES = {
  endpoints: ['POST /api/auth/login', 'GET /api/audit'],
  webRoutes: ['/login', '/programs'],
  mobileRoutes: ['/login', '/programs'],
  permissions: ['program.create', 'audit.view'],
};

const idsOf = (rows: readonly { item: string; storyIds: readonly string[] }[], item: string): readonly string[] | undefined =>
  rows.find((row) => row.item === item)?.storyIds;

describe('buildCoverage', () => {
  it('sin historias cada elemento aparece sin ids, en el orden de las fuentes', () => {
    const c = buildCoverage(SOURCES, []);
    expect(c.endpoints).toEqual([
      { item: 'POST /api/auth/login', storyIds: [] },
      { item: 'GET /api/audit', storyIds: [] },
    ]);
    expect(c.webRoutes.map((row) => row.item)).toEqual(['/login', '/programs']);
    expect(c.mobileRoutes.map((row) => row.item)).toEqual(['/login', '/programs']);
    expect(c.permissions.map((row) => row.item)).toEqual(['program.create', 'audit.view']);
  });

  it('una historia api cubre su endpoint y no la ruta web /login', () => {
    const c = buildCoverage(SOURCES, [story('US-LOGIN-001', 'api', { cubre: ['POST /api/auth/login'] })]);
    expect(idsOf(c.endpoints, 'POST /api/auth/login')).toEqual(['US-LOGIN-001']);
    expect(idsOf(c.webRoutes, '/login')).toEqual([]);
    expect(idsOf(c.mobileRoutes, '/login')).toEqual([]);
  });

  it('una historia web cubre la ruta web y no la móvil', () => {
    const c = buildCoverage(SOURCES, [story('US-LOGIN-002', 'web', { cubre: ['/login'] })]);
    expect(idsOf(c.webRoutes, '/login')).toEqual(['US-LOGIN-002']);
    expect(idsOf(c.mobileRoutes, '/login')).toEqual([]);
  });

  it('una historia movil cubre la ruta móvil /login y no la web', () => {
    const c = buildCoverage(SOURCES, [story('US-LOGIN-003', 'movil', { cubre: ['/login'] })]);
    expect(idsOf(c.mobileRoutes, '/login')).toEqual(['US-LOGIN-003']);
    expect(idsOf(c.webRoutes, '/login')).toEqual([]);
  });

  it('ios y android cuentan como móvil', () => {
    const c = buildCoverage(SOURCES, [story('US-LOGIN-004', 'ios', { cubre: ['/programs'] }), story('US-LOGIN-005', 'android', { cubre: ['/programs'] })]);
    expect(idsOf(c.mobileRoutes, '/programs')).toEqual(['US-LOGIN-004', 'US-LOGIN-005']);
    expect(idsOf(c.webRoutes, '/programs')).toEqual([]);
  });

  it('los permisos los cubre cualquier historia, también una transversal', () => {
    const c = buildCoverage(SOURCES, [story('US-PROG-001', 'transversal', { permisos: ['program.create'] }), story('US-PROG-002', 'api', { permisos: ['program.create', 'audit.view'] })]);
    expect(idsOf(c.permissions, 'program.create')).toEqual(['US-PROG-001', 'US-PROG-002']);
    expect(idsOf(c.permissions, 'audit.view')).toEqual(['US-PROG-002']);
  });

  it('un cubre de otra plataforma no cuenta: ni una ruta en una historia api ni un endpoint en una web', () => {
    const c = buildCoverage(SOURCES, [
      story('US-LOGIN-006', 'api', { cubre: ['/login'] }),
      story('US-LOGIN-007', 'web', { cubre: ['POST /api/auth/login'] }),
      story('US-LOGIN-008', 'transversal', { cubre: ['POST /api/auth/login', '/login'] }),
    ]);
    expect([...c.endpoints, ...c.webRoutes, ...c.mobileRoutes].flatMap((row) => row.storyIds)).toEqual([]);
  });

  it('una épica no cubre nada', () => {
    const epic: StoryFile = { kind: 'epic', path: 'docs/user-stories/login/epic.md', body: '', fm: { id: 'EP-LOGIN', tipo: 'epica', titulo: 'Acceso', etiquetas: ['epic'] } };
    const c = buildCoverage(SOURCES, [epic]);
    expect([...c.endpoints, ...c.webRoutes, ...c.mobileRoutes, ...c.permissions].flatMap((row) => row.storyIds)).toEqual([]);
  });

  it('los ids salen ordenados y sin repetir, vengan como vengan los archivos', () => {
    const c = buildCoverage(SOURCES, [
      story('US-LOGIN-010', 'api', { cubre: ['GET /api/audit', 'GET /api/audit'] }),
      story('US-LOGIN-002', 'api', { cubre: ['GET /api/audit'] }),
      story('US-LOGIN-002', 'api', { cubre: ['GET /api/audit'] }),
    ]);
    expect(idsOf(c.endpoints, 'GET /api/audit')).toEqual(['US-LOGIN-002', 'US-LOGIN-010']);
  });

  it('un cubre que no existe en el repositorio no inventa filas', () => {
    const c = buildCoverage(SOURCES, [story('US-LOGIN-009', 'api', { cubre: ['GET /api/no-existe'], permisos: ['no.existe'] })]);
    expect(c.endpoints.map((row) => row.item)).toEqual(['POST /api/auth/login', 'GET /api/audit']);
    expect(c.permissions.map((row) => row.item)).toEqual(['program.create', 'audit.view']);
  });

  it('un elemento repetido en una fuente es una sola fila', () => {
    const c = buildCoverage({ ...SOURCES, webRoutes: ['/login', '/login'] }, []);
    expect(c.webRoutes).toEqual([{ item: '/login', storyIds: [] }]);
  });
});

const COVERED: Coverage = {
  endpoints: [
    { item: 'POST /api/auth/login', storyIds: ['US-LOGIN-001', 'US-LOGIN-002'] },
    { item: 'GET /api/audit', storyIds: [] },
  ],
  webRoutes: [{ item: '/login', storyIds: ['US-LOGIN-003'] }],
  mobileRoutes: [{ item: '/login', storyIds: [] }],
  permissions: [{ item: 'program.create', storyIds: [] }],
};

describe('holes', () => {
  it('sin historias lista todos los elementos, con el tipo delante y en el orden endpoints, web, móvil, permisos', () => {
    expect(holes(buildCoverage(SOURCES, []))).toEqual([
      'endpoint: POST /api/auth/login',
      'endpoint: GET /api/audit',
      'ruta web: /login',
      'ruta web: /programs',
      'ruta móvil: /login',
      'ruta móvil: /programs',
      'permiso: program.create',
      'permiso: audit.view',
    ]);
  });

  it('solo lista lo que no tiene historias', () => {
    expect(holes(COVERED)).toEqual(['endpoint: GET /api/audit', 'ruta móvil: /login', 'permiso: program.create']);
  });

  it('con todo cubierto no hay huecos', () => {
    const full = buildCoverage(SOURCES, [
      story('US-A-001', 'api', { cubre: SOURCES.endpoints, permisos: SOURCES.permissions }),
      story('US-A-002', 'web', { cubre: SOURCES.webRoutes }),
      story('US-A-003', 'movil', { cubre: SOURCES.mobileRoutes }),
    ]);
    expect(holes(full)).toEqual([]);
  });
});

describe('summarizeHoles', () => {
  it('cuenta los huecos por tipo sobre el total de cada tipo', () => {
    expect(summarizeHoles(COVERED)).toBe('3 huecos (endpoints 1 de 2, rutas web 0 de 1, rutas móviles 1 de 1, permisos 1 de 1)');
    expect(summarizeHoles(buildCoverage(SOURCES, []))).toBe('8 huecos (endpoints 2 de 2, rutas web 2 de 2, rutas móviles 2 de 2, permisos 2 de 2)');
  });

  it('con una sola unidad no pluraliza mal: 0 huecos y 1 hueco', () => {
    expect(summarizeHoles({ endpoints: [], webRoutes: [], mobileRoutes: [], permissions: [] })).toBe('0 huecos (endpoints 0 de 0, rutas web 0 de 0, rutas móviles 0 de 0, permisos 0 de 0)');
    expect(summarizeHoles({ endpoints: [{ item: 'GET /api/x', storyIds: [] }], webRoutes: [], mobileRoutes: [], permissions: [] })).toMatch(/^1 hueco \(/);
  });
});

describe('renderCoverageMarkdown', () => {
  const md = renderCoverageMarkdown(COVERED);

  it('lleva cuatro tablas, una por tipo, con el recuento de cubiertos en el título', () => {
    expect(md).toContain('## Endpoints de la API (1 de 2 cubiertos)');
    expect(md).toContain('## Rutas web (1 de 1 cubiertas)');
    expect(md).toContain('## Rutas móviles (0 de 1 cubiertas)');
    expect(md).toContain('## Permisos (0 de 1 cubiertos)');
    expect(md.match(/^\| --- \| --- \|$/gm)).toHaveLength(4);
  });

  it('cada fila muestra el elemento y sus historias, y marca — en los huecos', () => {
    expect(md).toContain('| `POST /api/auth/login` | US-LOGIN-001, US-LOGIN-002 |');
    expect(md).toContain('| `GET /api/audit` | — |');
    expect(md).toContain('| `/login` | US-LOGIN-003 |');
    expect(md).toContain('| `program.create` | — |');
  });

  it('es determinista: sin fechas, solo saltos \\n y una sola línea final', () => {
    expect(renderCoverageMarkdown(COVERED)).toBe(md);
    expect(md).not.toContain('\r');
    expect(md.endsWith('|\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
    expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('con una cobertura vacía deja las cuatro tablas con su cabecera', () => {
    const empty = renderCoverageMarkdown({ endpoints: [], webRoutes: [], mobileRoutes: [], permissions: [] });
    expect(empty).toContain('## Endpoints de la API (0 de 0 cubiertos)');
    expect(empty.match(/^\| --- \| --- \|$/gm)).toHaveLength(4);
  });
});
