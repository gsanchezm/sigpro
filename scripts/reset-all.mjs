// Reinicia el seed de TODOS los tenants: POST ${API_URL}/admin/reset?all=true con X-Admin-Key.
// Lo ejecuta el Cron Job nocturno de Render (render.yaml) y sirve también a mano:
//   API_URL=http://localhost:3000/api ADMIN_KEY=dev-admin-key node scripts/reset-all.mjs
// Solo usa `fetch` (Node ≥ 18): no necesita instalar dependencias.

const apiUrl = process.env.API_URL ?? 'http://localhost:3000/api';
const adminKey = process.env.ADMIN_KEY;

// Con TENANT_SUFFIX_SEED los ids de alumno llevan un sufijo secreto (`alumno07-k4x9`): el log del cron, que ve quien tenga
// acceso al panel de Render, lo oculta (`alumno07-****`). Los ids sin sufijo (`demo`, `alumno07`) se imprimen como siempre.
const maskTenant = (tenant) => tenant.replace(/^(alumno\d+)-[a-z0-9]+$/, '$1-****');

if (!adminKey) {
  console.error('Falta ADMIN_KEY en el entorno.');
  process.exit(1);
}

try {
  const response = await fetch(`${apiUrl}/admin/reset?all=true`, { method: 'POST', headers: { 'X-Admin-Key': adminKey } });
  const body = await response.text();
  if (!response.ok) {
    console.error(`Reset global falló: ${response.status} ${body}`);
    process.exit(1);
  }
  const results = JSON.parse(body);
  results.forEach((result) => console.log(`✔ ${maskTenant(result.tenant)} (${result.ms} ms)`));
  console.log(`Reset completado: ${results.length} tenant(s).`);
} catch (error) {
  console.error('No se pudo contactar con la API:', error instanceof Error ? error.message : error);
  process.exit(1);
}
