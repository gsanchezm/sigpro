import type { FormEventHandler, ReactNode } from 'react';
import type { AuthErrorView } from '../../lib/errors';

const cardClass = (wide: boolean): string => `card flex flex-col gap-3.5 p-6 ${wide ? 'w-[min(520px,100%)]' : 'w-[min(400px,100%)]'}`;

interface AuthFormProps {
  readonly testId: string;
  readonly busy: boolean;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly wide?: boolean;
  readonly children: ReactNode;
}

/** Tarjeta de Acceso como <form noValidate> (validación propia + aria-invalid). */
export const AuthForm = ({ testId, busy, onSubmit, wide = false, children }: AuthFormProps) => (
  <form data-testid={testId} noValidate onSubmit={onSubmit} aria-busy={busy} className={cardClass(wide)}>
    {children}
  </form>
);

/** Tarjeta de Acceso sin formulario (panel de verificación). */
export const AuthPanel = ({ testId, children }: { testId: string; children: ReactNode }) => (
  <div data-testid={testId} role="status" className={cardClass(false)}>
    {children}
  </div>
);

export const AuthHeading = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex flex-col gap-1">
    <h1 className="page-title">{title}</h1>
    <p className="m-0 text-[12.5px] text-fg-2">{hint}</p>
  </div>
);

/** Alerta de error del servidor (role=alert): título en negrita + traza HTTP en mono. */
export const ServerAlert = ({ error, testId }: { error: AuthErrorView; testId: string }) => (
  <div role="alert" data-testid={testId} className="alert alert-danger flex flex-col gap-0.5">
    <span className="font-semibold">{error.title}</span>
    {error.trace ? <span className="trace">{error.trace}</span> : null}
  </div>
);

export const PasswordToggle = ({ testId, label, pressed, text, onToggle }: { testId: string; label: string; pressed: boolean; text: string; onToggle: () => void }) => (
  <button
    type="button"
    data-testid={testId}
    aria-label={label}
    aria-pressed={pressed}
    onClick={onToggle}
    className="absolute top-1 right-1 h-7 cursor-pointer rounded-ctl border-0 bg-transparent px-2 text-[11.5px] text-fg-3 hover:bg-surface-2 hover:text-fg"
  >
    {text}
  </button>
);
