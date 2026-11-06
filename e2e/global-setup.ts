// Antes de la suite: restaura el seed de todos los tenants (POST /api/admin/reset?all=true con X-Admin-Key).
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin-key';

export default async function globalSetup(): Promise<void> {
  const response = await fetch(`${API_URL}/admin/reset?all=true`, { method: 'POST', headers: { 'x-admin-key': ADMIN_KEY } });
  if (!response.ok) throw new Error(`Reset global falló: ${response.status} ${await response.text()}`);
}
