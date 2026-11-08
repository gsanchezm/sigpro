import { accesoEn, accesoEs } from './acceso';
import { adminEn, adminEs } from './admin';
import { auditoriaEn, auditoriaEs } from './auditoria';
import { busquedaEn, busquedaEs } from './busqueda';
import { commonEn, commonEs } from './common';
import { documentosEn, documentosEs } from './documentos';
import { hitosEn, hitosEs } from './hitos';
import { labEn, labEs } from './lab';
import { legalEn, legalEs } from './legal';
import { misionEn, misionEs } from './mision';
import { ncEn, ncEs } from './nc';
import { perfilEn, perfilEs } from './perfil';
import { programasEn, programasEs } from './programas';
import { proveedoresEn, proveedoresEs } from './proveedores';
import { requisitosEn, requisitosEs } from './requisitos';
import { verificacionEn, verificacionEs } from './verificacion';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'es';

// Textos de Programas que no vienen del prototipo (motivos de permisos, edición del programa).
const programasExtraEs = {
  roleNoEdit: 'Tu rol no permite modificar programas',
  roleNoArchive: 'Tu rol no permite archivar programas',
  roleNoPermission: 'Tu rol no permite esta acción',
  editProgram: 'Editar programa',
  editDenied: 'Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.',
  save: 'Guardar',
  saveAndClose: 'Guardar y cerrar',
  updated: 'Programa actualizado',
  updatedBody: '{code} se guardó correctamente',
  backToDetail: 'Volver al detalle',
  editButton: 'Editar programa',
  editButtonDisabled: 'Tu rol no permite modificar programas',
  codeReadonly: 'El código no se puede cambiar',
  noChanges: 'No hay cambios que guardar',
};
const programasExtraEn: typeof programasExtraEs = {
  roleNoEdit: 'Your role cannot edit programs',
  roleNoArchive: 'Your role cannot archive programs',
  roleNoPermission: 'Your role cannot perform this action',
  editProgram: 'Edit program',
  editDenied: 'Your role cannot modify programs. You can view the detail but not save changes.',
  save: 'Save',
  saveAndClose: 'Save and close',
  updated: 'Program updated',
  updatedBody: '{code} was saved',
  backToDetail: 'Back to detail',
  editButton: 'Edit program',
  editButtonDisabled: 'Your role cannot edit programs',
  codeReadonly: 'The code cannot be changed',
  noChanges: 'There are no changes to save',
};

export const messages = {
  es: {
    acceso: accesoEs,
    programas: { ...programasEs, ...programasExtraEs },
    common: commonEs,
    lab: labEs,
    requisitos: requisitosEs,
    verificacion: verificacionEs,
    documentos: documentosEs,
    auditoria: auditoriaEs,
    legal: legalEs,
    nc: ncEs,
    mision: misionEs,
    admin: adminEs,
    hitos: hitosEs,
    perfil: perfilEs,
    busqueda: busquedaEs,
    proveedores: proveedoresEs,
  },
  en: {
    acceso: accesoEn,
    programas: { ...programasEn, ...programasExtraEn },
    common: commonEn,
    lab: labEn,
    requisitos: requisitosEn,
    verificacion: verificacionEn,
    documentos: documentosEn,
    auditoria: auditoriaEn,
    legal: legalEn,
    nc: ncEn,
    mision: misionEn,
    admin: adminEn,
    hitos: hitosEn,
    perfil: perfilEn,
    busqueda: busquedaEn,
    proveedores: proveedoresEn,
  },
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

export {
  accesoEn,
  accesoEs,
  adminEn,
  adminEs,
  hitosEn,
  hitosEs,
  misionEn,
  misionEs,
  ncEn,
  ncEs,
  perfilEn,
  perfilEs,
  busquedaEn,
  busquedaEs,
  proveedoresEn,
  proveedoresEs,
  auditoriaEn,
  auditoriaEs,
  commonEn,
  commonEs,
  documentosEn,
  documentosEs,
  labEn,
  labEs,
  legalEn,
  legalEs,
  programasEn,
  programasEs,
  requisitosEn,
  requisitosEs,
  verificacionEn,
  verificacionEs,
};
