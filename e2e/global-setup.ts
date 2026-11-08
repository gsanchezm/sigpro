// Antes de la suite: restaura el seed de todos los tenants (POST /api/admin/reset?all=true con X-Admin-Key).
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin-key';

export default async function globalSetup(): Promise<void> {
  // `E2E_SKIP_GLOBAL_RESET=1`: varias ejecuciones a la vez contra la misma pila no deben borrarse los datos entre sí.
  // Cada spec ya reinicia su propio tenant en `beforeAll`, así que basta con saltarse el reinicio global.
  if (process.env.E2E_SKIP_GLOBAL_RESET) return;
  const response = await fetch(`${API_URL}/admin/reset?all=true`, { method: 'POST', headers: { 'x-admin-key': ADMIN_KEY } });
  if (!response.ok) throw new Error(`Reset global falló: ${response.status} ${await response.text()}`);
}
