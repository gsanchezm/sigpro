import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { cell } from '../../support/checks';
import { TENANT_A } from '../../../story-runs/support/prepare';

// US-REQ-EDICION-016 — Añadir un requisito hijo desde la hoja de otro requisito (app móvil). Historia «no-implementada»: la hoja de la
// app móvil solo tiene «Editar», «Mover a…» y «Eliminar». No se navega la app: cada fila devuelve notExecutable.

const MOTIVO = 'capacidad futura, no se prueba contra la app';

const addChildNotImplemented: BrowserRowHandler = async (row) =>
  notExecutable(`el diálogo «Nuevo requisito» abre con «Requisito padre» igual a «REQ-001 · Disponibilidad del subsistema 001» para ${cell(row, 'cuenta')}`, MOTIVO);

defineBrowserRows({
  story: 'US-REQ-EDICION-016',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, addChildNotImplemented]]),
});
