import { accesoEn, accesoEs } from './acceso';
import { commonEn, commonEs } from './common';
import { labEn, labEs } from './lab';
import { programasEn, programasEs } from './programas';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'es';

// Motivos de permisos que no vienen del prototipo (Editar/Archivar deshabilitados).
const programasExtraEs = {
  roleNoEdit: 'Tu rol no permite modificar programas',
  roleNoArchive: 'Tu rol no permite archivar programas',
  roleNoPermission: 'Tu rol no permite esta acción',
};
const programasExtraEn: typeof programasExtraEs = {
  roleNoEdit: 'Your role cannot edit programs',
  roleNoArchive: 'Your role cannot archive programs',
  roleNoPermission: 'Your role cannot perform this action',
};

export const messages = {
  es: { acceso: accesoEs, programas: { ...programasEs, ...programasExtraEs }, common: commonEs, lab: labEs },
  en: { acceso: accesoEn, programas: { ...programasEn, ...programasExtraEn }, common: commonEn, lab: labEn },
} as const;

export type Messages = (typeof messages)['es'];
export type Namespace = keyof Messages;
export type MessageKey<N extends Namespace> = keyof Messages[N] & string;

const interpolate = (template: string, vars?: Readonly<Record<string, string | number>>): string =>
  vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template;

export type Translator = <N extends Namespace>(ns: N, key: MessageKey<N>, vars?: Readonly<Record<string, string | number>>) => string;

export const createTranslator =
  (lang: Lang): Translator =>
  (ns, key, vars) =>
    interpolate((messages[lang][ns] as Record<string, string>)[key] ?? key, vars);

export { accesoEn, accesoEs, commonEn, commonEs, labEn, labEs, programasEn, programasEs };
