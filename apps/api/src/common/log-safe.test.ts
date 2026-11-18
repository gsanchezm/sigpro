import { describe, expect, it } from 'vitest';
import { describeError, redact } from './log-safe';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsInRlbmFudCI6ImRlbW8ifQ.c2lnbmF0dXJhLWRlLXBydWViYQ';
const HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab';

describe('redact', () => {
  it('tapa correos, tokens JWT, bearer, hashes y campos sensibles', () => {
    const text = `Fallo con ana.real@gmail.com Authorization: Bearer ${JWT} passwordHash: ${HASH} password="Clave1234!" x-admin-key: dev-admin-key`;
    const clean = redact(text);
    for (const secret of ['ana.real', 'gmail.com', JWT, HASH, 'Clave1234!', 'dev-admin-key']) expect(clean).not.toContain(secret);
    expect(clean).toContain('<correo>');
  });

  it('deja intacto un texto sin datos sensibles', () => {
    expect(redact('Seed v3 aplicado a 26 tenant(s)')).toBe('Seed v3 aplicado a 26 tenant(s)');
  });
});

describe('describeError', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly meta: unknown,
    ) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
    }
  }

  const prismaError = () =>
    new PrismaClientKnownRequestError(
      `\nInvalid \`prisma.user.create()\` invocation:\n\n{ data: { email: "persona.real@gmail.com", passwordHash: "${HASH}", name: "Ana Real" } }\n\nUnique constraint failed on the fields: (\`tenantId\`,\`email\`)`,
      'P2002',
      { modelName: 'User', target: ['tenantId', 'email'] },
    );

  it('un error de Prisma se describe sin su mensaje: ni la llamada ni sus argumentos', () => {
    const text = describeError(prismaError());
    expect(text).toContain('PrismaClientKnownRequestError');
    expect(text).toContain('[P2002]');
    expect(text).toContain('modelo=User');
    expect(text).toContain('campos=tenantId,email');
    for (const secret of ['persona.real', 'gmail', HASH, 'Ana Real', 'Invalid']) expect(text).not.toContain(secret);
  });

  it('la pila no repite el mensaje: solo conserva las líneas «at …»', () => {
    const text = describeError(prismaError());
    expect(text).toMatch(/\n\s+at /);
    expect(text).not.toContain('invocation');
  });

  it('un error cualquiera conserva su mensaje pero con los datos sensibles tapados', () => {
    const text = describeError(new Error(`No se pudo enviar a persona.real@gmail.com con el token Bearer ${JWT}`));
    expect(text).toContain('Error: No se pudo enviar');
    expect(text).not.toContain('persona.real');
    expect(text).not.toContain(JWT);
  });

  it('un valor que no es un Error también se describe tapado', () => {
    expect(describeError('falló para persona.real@gmail.com')).toBe('falló para <correo>');
  });
});
