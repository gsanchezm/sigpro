import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, type Step } from '../../support/browser';
import { ALUMNO_ADMIN } from './common';

// Piezas de la app móvil servida como web de Expo (390 × 844; NO es nativa). Los campos de la app se localizan por su
// `aria-label` (la etiqueta visible), y los botones por su nombre accesible, igual que los lee la API de accesibilidad.

export const MOBILE_NOTE = 'Se mide la app móvil como web de Expo a 390 × 844 px: no es nativo (no hay VoiceOver ni TalkBack).';

/** Entorno: sin Expo levantado no hay app móvil que medir; la fila no se ejecuta en esta superficie (no es un hallazgo). */
export const expoNotRunning = (url: string): string => `Entorno: la app móvil (Expo web) no responde en ${url} durante esta superficie; la fila no se ejecuta aquí (hace falta Expo levantado en ese puerto).`;

/** Campo de la app por su etiqueta (`aria-label`); los campos de contraseña no tienen rol `textbox`. */
export const mobileField = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true });
export const mobileButton = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const mobileHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
/** Llegada a Programas en la app móvil: su región de filtros (el título del encabezado no es un encabezado de nivel 1). */
export const mobileProgramsArrival = (page: Page): Locator => page.getByRole('region', { name: 'Filtros', exact: true });

/** Inicia sesión en la app móvil con el tenant de la fila en «Tenant de trabajo» (un solo `fill`: el campo vuelve a `demo` al vaciarse). */
export const mobileSignInSteps = (page: Page, email: string, password: string): readonly Step[] => [
  ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
  ['ver el título «Iniciar sesión»', () => mobileHeading(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
  ['escribir el tenant en «Tenant de trabajo»', () => mobileField(page, 'Tenant de trabajo').fill(TENANT_A, ACTION)],
  ['escribir el correo', () => mobileField(page, 'Correo electrónico').fill(email, ACTION)],
  ['escribir la contraseña', () => mobileField(page, 'Contraseña').fill(password, ACTION)],
  ['pulsar «Entrar»', () => mobileButton(page, 'Entrar').click(ACTION)],
];

/** Inicia sesión de administración del tenant (sin segundo factor) en la app móvil y espera la lista de programas. */
export const mobileSignInAsAlumnoAdmin = (page: Page): readonly Step[] => [
  ...mobileSignInSteps(page, ALUMNO_ADMIN.email, ALUMNO_ADMIN.password),
  ['llegar a la lista de programas', () => mobileProgramsArrival(page).waitFor({ timeout: CEILING_MS })],
];

