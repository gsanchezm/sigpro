---
id: EP-AUDITORIA
tipo: epica
titulo: "Registro de auditoría"
etiquetas: [epic]
---

## Objetivo
Que quien administra o audita un tenant pueda ver qué se hizo en él, quién lo hizo y cuándo, con el detalle de cada cambio, filtrado y paginado, y que cada operación que cambia datos deje ese rastro en la misma operación. El registro es de solo lectura: nadie lo edita ni lo borra desde la aplicación.

## Alcance
- `GET /api/audit`: listado de los eventos del tenant del token, del más reciente al más antiguo, con paginación por cursor, filtros por entidad, rango de días y texto, y el permiso `audit.view` (admin y auditor).
- Los eventos que escriben las operaciones de la API: qué acción, entidad, código y detalle deja cada una. Las operaciones de cada módulo se describen en su propia épica; aquí se ejercita una operación de ejemplo por evento.
- La pantalla `/audit` en la web (lista, contador, carga al final, filtros, avisos por rol) y en la app móvil (la misma pantalla, con las fechas escritas a mano).

## Plataformas
API, web y móvil común a iOS y Android. La pantalla no tiene comportamiento propio de un sistema nativo: no hay historias `ios` ni `android`.

## Historias
- US-AUDITORIA-001: [API] Listar el registro de auditoría del más reciente al más antiguo, en páginas por cursor
- US-AUDITORIA-002: [API] Filtrar el registro por entidad, por rango de días y por texto
- US-AUDITORIA-003: [API] Leer el registro solo con el permiso de auditoría y solo del tenant del token
- US-AUDITORIA-004: [API] Qué evento deja cada operación de programas, requisitos, ejecuciones y documentos
- US-AUDITORIA-005: [API] Eventos de no conformidades, hitos, usuarios, modo caos y registro, y ninguno en las operaciones rechazadas
- US-AUDITORIA-006: [Web] Ver el registro de auditoría en /audit: filas, contador, carga al final y avisos por rol
- US-AUDITORIA-007: [Web] Filtrar, buscar y limpiar el registro de auditoría en /audit
- US-AUDITORIA-008: [Móvil] Ver el registro de auditoría en /audit: lista, «Cargar más» y avisos por rol
- US-AUDITORIA-009: [Móvil] Filtrar y buscar en /audit con las fechas escritas a mano

## Fuera de alcance
- La pestaña «Usuarios», la de «Modo caos» y la de «Datos» de Administración, y la elección de pestaña por la dirección: épicas EP-ADMIN-USUARIOS y EP-CAOS-RESET. La pestaña «Auditoría» de Administración sí es de esta épica: su sección muestra este mismo registro.
- Los cambios de cada módulo (alta, edición, borrado, paso de estado y similares): cada uno está en la épica de su módulo. Aquí solo se ejercita una operación de ejemplo por evento.
- Exportar el registro, editarlo o borrarlo: no existen ni en la API ni en la aplicación.
