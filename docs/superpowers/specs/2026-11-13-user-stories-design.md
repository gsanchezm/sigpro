# Historias de usuario de SIGPRO — diseño

Fecha: 2026-11-13 · Estado: borrador para aprobación

## Intención y por qué

SIGPRO existe para que el alumnado practique Playwright + TypeScript. Hoy el curso tiene la aplicación, los specs de humo y la guía del alumno, pero **no tiene requisitos escritos**: quien quiere probar un comportamiento tiene que deducirlo de la interfaz o del código.

Este trabajo produce un conjunto de **historias de usuario en español**, publicadas como issues de GitHub, para dos usos:

1. **Ejercitar la lectura de requisitos**, de forma manual (alumnado) y con agentes: dado un issue, derivar los casos de prueba sin abrir el código.
2. **Ser el oráculo del ejercicio de defectos.** Los bugs plantados (`docs/planted-bugs.md`, solo instructor) son desviaciones respecto de lo que dicen las historias. Quien prueba contra el texto los encuentra; quien solo prueba el camino feliz, no.

Por eso las historias describen **el comportamiento correcto**, no una transcripción del código con sus rarezas.

## Objetivos

- Cubrir **lo que la app hace y lo que una buena especificación habría pedido**: validaciones, rutas negativas, valores límite, permisos por rol, estados vacío/carga/error.
- Un issue = **un comportamiento verificable en una plataforma**. Granularidad máxima: «bloqueo tras 5 intentos» es una historia propia, no una línea dentro de «Login».
- Cada historia es autosuficiente: título, historia, reglas y criterios de aceptación bastan para diseñar pruebas.
- Cobertura demostrable: cada endpoint de la API, cada ruta de la web y de la app móvil y cada clave de `PERMISSIONS` (`packages/shared/src/permissions.ts`) aparece en al menos una historia.
- Todo ejemplo concreto (datos, mensajes, códigos HTTP) es **cierto contra la app limpia** (`PLANTED_BUGS=false`), está registrado como discrepancia o pertenece a una historia marcada `no-implementada` (capacidad que la app no tiene o solo simula; ver «Funcionalidad ausente o simulada»).

## No objetivos

- Modificar código de la aplicación ni corregir discrepancias (solo se listan).
- Escribir specs de Playwright derivados de las historias.
- Usar GitHub Projects ni milestones.
- Traducir las historias al inglés.
- Cubrir `/lab`, el material de `examples/` ni los propios bugs plantados.

## Anti-objetivos (fracaso aunque «funcione»)

- Historias que fijan como requisito una rareza involuntaria del código.
- Que alguna historia **mencione, marque o insinúe** un bug plantado. La historia dice el comportamiento correcto (el valor límite correcto, el orden correcto) y nada más. El repositorio es público.
- Historias gigantes tipo «Gestión de programas» o issues duplicados.
- Acoplar el requisito a la implementación: `data-testid`, selectores, nombres de componentes o de funciones.
- Publicar issues en GitHub sin autorización explícita.

## Decisiones del usuario

1. Las historias son el oráculo del ejercicio de pruebas y de defectos.
2. Documentan lo hecho **y** lo que se debió haber pedido.
3. Se organizan en **épicas** (por ejemplo, «Login») y, de cada épica, las historias que haga falta.
4. En móvil: una historia común, y historias `ios` / `android` separadas solo donde el comportamiento difiere de verdad.
5. Etiquetas por plataforma más una etiqueta `transversal`.
6. Solo texto y datos concretos. Los criterios se expresan como **Esquemas del escenario** (tablas de Ejemplos). Sin `data-testid`.
7. Épicas y luego issues; sin Projects.
8. Primero Markdown versionado y revisable en `docs/user-stories/`; después un script idempotente que sincroniza con GitHub.
9. Cuando la app **no tiene o solo simula** una capacidad (aprobar cuentas pendientes, correo real de recuperación y verificación, SSO, lagunas del móvil), la historia describe **el ideal**, no el contrato actual. Sus ejemplos no se pueden ejecutar y eso se marca (ver «Funcionalidad ausente o simulada»).

## Modelo de contenido

**Épica** = issue padre con etiqueta `epic`. Contiene: objetivo, alcance, plataformas que toca, lista de sus historias (sub-issues) y qué queda fuera.

**Historia** = sub-issue de una épica. Un comportamiento en una plataforma.

Etiquetas (se crean si no existen, además de las 10 por defecto del repositorio):

| Etiqueta | Uso |
| --- | --- |
| `epic` | issue padre |
| `api` | endpoints, códigos HTTP, validación en servidor, permisos |
| `web` | interfaz web (escritorio y diseño responsive) |
| `movil` | app Expo común a iOS y Android |
| `ios` | solo cuando el comportamiento difiere en iOS |
| `android` | solo cuando el comportamiento difiere en Android |
| `transversal` | regla que vale en todas las plataformas y no tiene interfaz ni endpoint propios que describir (i18n, tema, accesibilidad, aislamiento por tenant) |
| `no-implementada` | la capacidad que describe la historia no existe en la app o solo está simulada; es material de lectura, no se puede probar contra la app |

Cada historia lleva **exactamente una** etiqueta de plataforma (`api`, `web`, `movil`, `ios`, `android` o `transversal`); `no-implementada` se suma a ella cuando corresponde.

**Cuándo hay historia `ios` / `android`:** solo si el comportamiento observable cambia por el sistema: botón atrás de Android, selector de imágenes y de documentos, hoja de compartir, permisos del sistema, teclado, áreas seguras. Si el comportamiento es el mismo, basta la historia `movil`. Aviso: iOS nunca se ha abierto en un Simulador (`docs/MOBILE-PARITY.md`); las historias `ios` no se pueden ejecutar y se marcan así en el archivo.

**Misma regla en varias plataformas:** cada plataforma tiene su historia, redactada con su superficie (en `api`, estados y cuerpos HTTP; en `web` y `movil`, lo que ve y hace el usuario). Se enlazan entre sí con «Relacionadas».

## Formato de un archivo de historia

Un archivo por issue. Estructura: `docs/user-stories/<slug-épica>/epic.md` y `docs/user-stories/<slug-épica>/US-<SLUG>-NNN.md`.

````markdown
---
id: US-LOGIN-003
tipo: historia            # historia | epica
epica: EP-LOGIN
titulo: "[Web] Bloquear la cuenta tras 5 intentos fallidos"
etiquetas: [web]
relacionadas: [US-LOGIN-002]
verificacion: ejecutada   # ejecutada | codigo | pendiente-nativo | no-ejecutable
---

## Historia
Como usuario con cuenta activa, quiero ver un aviso claro cuando mi cuenta se bloquea,
para saber que debo esperar o pedir ayuda y no seguir intentando.

## Reglas
- (reglas de negocio concretas, una por línea)

## Criterios de aceptación
```gherkin
Característica: Bloqueo de cuenta tras intentos fallidos

  Esquema del escenario: <nombre del comportamiento>
    Dado <contexto con datos concretos>
    Cuando <acción>
    Entonces <resultado observable>

    Ejemplos:
      | dato | resultado |
      | ...  | ...       |
```

## Fuera de alcance
- (si aplica)
````

Reglas del formato:

- Gherkin en español (`Característica`, `Esquema del escenario`, `Ejemplos`, `Dado`, `Cuando`, `Entonces`, `Y`).
- Al menos un Esquema del escenario por historia, con la tabla de Ejemplos incluyendo casos negativos y valores límite (n−1, n, n+1) cuando haya un umbral.
- Datos concretos: códigos del seed (`PRG-001`…), usuarios demo, roles, mensajes exactos de la interfaz en español, códigos HTTP.
- Prohibido: `data-testid`, `getByRole`, `getByTestId`, nombres de componentes o de funciones.
- El front matter es para el repositorio. En GitHub, `etiquetas` pasan a labels, `titulo` a título y el cuerpo es el Markdown de debajo. `verificacion` no se publica.
- Identificadores: épica `EP-<SLUG>`, historia `US-<SLUG>-NNN` (numeración dentro de la épica, sin reutilizar números). Título en GitHub con prefijo de plataforma: `[API]`, `[Web]`, `[Móvil]`, `[iOS]`, `[Android]`, `[Transversal]`.

## Funcionalidad ausente o simulada

Decisión del usuario: cuando la app no tiene una capacidad o solo la simula, la historia describe **el ideal**.

Casos conocidos (comprobados en el código el 2026-11-13):

- **Aprobar cuentas pendientes.** El registro crea la cuenta con `pendingApproval` y ningún código de la API lo quita; el `PATCH /api/admin/users/:id` solo cambia `active` y `role`. Va en la épica de Usuarios y roles, en `api`, `web` y `movil`.
- **Correo de recuperación y de verificación.** `POST /api/auth/forgot` y `/resend` responden 202 sin enviar nada. La historia del ideal (llega un correo con enlace) es `no-implementada`.
- **SSO.** `GET /api/auth/sso` responde 501 `sso_not_available`. El acceso con SSO es `no-implementada`.
- **Lagunas del móvil** documentadas en `docs/MOBILE-PARITY.md` y `docs/DECISIONS.md`: copiar código, añadir hijo, descripciones enriquecidas, extras del login (mostrar contraseña, mantener la sesión, SSO, aviso de sesión cerrada) y «Guardar» alterno del modo caos fuera del panel de Administración. Cada una es una historia `movil` marcada `no-implementada`, porque la web sí la tiene y el objetivo es el espejo funcional.

Reglas:

- Estas historias llevan `verificacion: no-ejecutable` en el archivo y la etiqueta `no-implementada` en GitHub. Sus ejemplos se revisan por lectura contra el plan, `DECISIONS.md` y la plataforma que sí tiene la capacidad; no se ejecutan.
- Si el sucedáneo tiene un contrato observable (el 202 de `/forgot`: responde igual exista o no el correo; el 501 de `/sso`), ese contrato tiene su **propia historia ejecutable**, aparte de la del ideal. Eso cubre además el endpoint en la matriz de cobertura.
- `no-implementada` se usa **solo** para capacidades sin ningún camino de código real, o simuladas a propósito. Un comportamiento que existe pero está mal, sea o no un bug plantado, **nunca** se marca: es el material del ejercicio. Duda razonable: si hay pantalla, ruta o endpoint con comportamiento real, no es `no-implementada`.

## Cómo se escribe cada historia (fuentes)

Para cada épica, el redactor lee `docs/SIGPRO-plan.md` (backlog), `docs/DECISIONS.md`, la pantalla web (`apps/web/src/pages/<módulo>/`), el controlador y servicio de la API, las reglas y esquemas de `packages/shared`, la pantalla móvil equivalente y el seed.

- **Referencia de comportamiento:** la app arrancada con `PLANTED_BUGS=false`.
- **Distinguir lo intencionado:** el redactor consulta `docs/planted-bugs.md` (local, solo instructor) para no confundir un defecto plantado con una discrepancia real, y para asegurarse de que su historia dice lo correcto. No cita ese archivo en ningún entregable.
- Si un comportamiento que **sí existe** en la app limpia difiere de lo que se debió pedir (y no es un bug plantado), la historia dice lo que se debió pedir y la diferencia se anota en **`docs/story-discrepancies.md`**, archivo **ignorado por git** como `planted-bugs.md`: el repositorio es público y ese archivo es material de instructor. Esto cambia lo dicho en la conversación («`DISCREPANCIAS.md` dentro de `docs/user-stories/`»), porque una confusión del redactor filtraría un bug plantado.

## Verificación y control de calidad

- **Ejemplos comprobados:** cada ejemplo concreto se ejecuta contra la app limpia (API, web en Chromium, Expo web) antes de darlo por bueno. Android solo se ha usado en el emulador (API 33), iOS no: esas historias llevan `verificacion: pendiente-nativo`. Las historias `no-implementada` quedan fuera de esta regla (`verificacion: no-ejecutable`).
- **Linter de historias** (script del repositorio, parte del trabajo): valida front matter, un único label de plataforma, ids únicos, épica existente, al menos un `Esquema del escenario`, coherencia entre `verificacion: no-ejecutable` y la etiqueta `no-implementada` (una implica la otra), ausencia de términos prohibidos (`data-testid`, `getByTestId`, `getByRole`, `plantedBugs`, `planted`, `defecto plantado`) y que ninguna historia cite `planted-bugs`.
- **Matriz de cobertura** (`docs/user-stories/COBERTURA.md`, versionada): endpoint de la API ↔ historias `api`; ruta web ↔ historias `web`; ruta móvil ↔ historias `movil`; clave de `PERMISSIONS` ↔ historias. Los huecos deben ser cero o estar justificados.

## Borrador de épicas (el plan las ajusta)

Estimación mía: unas 30 épicas y del orden de 250–400 issues. Se agrupan por módulo del plan.

| Grupo | Épicas |
| --- | --- |
| Acceso | Login (con bloqueo, cuentas pendientes o desactivadas, recordar sesión, mostrar contraseña, aviso de sesión cerrada, logout) · Segundo factor (MFA) · Registro y reenvío de verificación · Recuperar contraseña · Sesión y renovación de token · Acceso con SSO (ideal `no-implementada` más el contrato 501) |
| Programas | Lista, filtros, orden y paginación · Métricas · Detalle con pestañas · Alta (asistente) y edición con validaciones · Archivar, duplicar, eliminar, selección múltiple y exportación CSV · Hitos · Proveedores |
| Requisitos | Árbol y vista documento · Alta, edición, borrado y reordenación · Flujo de estados y permisos · Matriz de trazabilidad |
| Verificación | Casos de prueba y detalle · Ejecuciones y evidencias · Informe PDF |
| No conformidades | Tablero y transiciones · Alta, edición, asignación, comentarios y cierre |
| Documentos | Lista, ficha y visor · Versionado, comparación y descarga · Documentos restringidos |
| Panel de misión | Indicadores y gráficas · Feed en tiempo real |
| Administración | Usuarios y roles (incluye la aprobación de cuentas pendientes, `no-implementada`) · Auditoría · Modo caos y reinicio del tenant |
| Transversales | Idioma ES/EN · Tema claro/oscuro · Navegación, búsqueda global y avisos (campana) · Notificaciones (toasts) · Perfil y preferencias · Páginas legales y ayuda · Multi-tenant y matriz de permisos · Accesibilidad · API de plataforma (health, config, OpenAPI) |

El plan decide cuáles se fusionan o se dividen.

## Sincronización con GitHub

Script `scripts/sync-user-stories.*` (lenguaje a elegir según el resto del repositorio):

- **Idempotente:** identifica cada issue por una marca oculta en el cuerpo (`<!-- sigpro-story-id: US-LOGIN-003 -->`), no por el título. Crear, actualizar si el archivo cambió, nunca duplicar.
- **`--dry-run` por defecto.** La ejecución real exige un flag explícito y la autorización del usuario en esa sesión.
- Crea las etiquetas que falten; crea primero las épicas y luego las historias, vinculándolas como **sub-issues** de GitHub. Si la API de sub-issues no está disponible en este repositorio, alternativa: lista de tareas en el issue de la épica.
- Respeta los límites de la API (espaciado entre peticiones).
- No cierra ni borra issues, salvo con un flag explícito.

Repositorio destino: `gsanchezm/sigpro` (público, Issues activos, 0 issues hoy).

## Proceso y entrega

1. **Piloto: `EP-LOGIN` completa** (API, web, móvil y, donde haya diferencia, iOS y Android), incluidas las historias `no-implementada` del login (mostrar contraseña, mantener la sesión y aviso de sesión cerrada en móvil; SSO), para que el usuario apruebe también ese caso del formato.
2. El resto de épicas, de una en una o en lotes. Cada épica pasa el linter, se anota en `docs/CHANGELOG.md` y se commitea (`docs(stories): …`). Se actualiza `docs/STATUS.md`.
3. Matriz de cobertura y revisión final.
4. Sincronización en seco, revisión por el usuario y, solo si autoriza, sincronización real. `git push` y publicación solo con su autorización cada vez.

## Lo que decido yo (a revisar)

- Un issue = un comportamiento en una plataforma; no hay historia «madre» agnóstica además de las plataformas.
- Etiqueta `transversal` como una de las opciones de plataforma, no como etiqueta adicional.
- Prefijo de plataforma en el título, ids `EP-` / `US-`, estructura de carpetas por épica.
- Gherkin en español.
- `docs/story-discrepancies.md` ignorado por git, en lugar de dentro de `docs/user-stories/`.
- Ejemplos verificados contra la app limpia, linter y matriz de cobertura como requisitos del trabajo.
- Sincronización en seco por defecto.
- Borrador de unas 30 épicas (dije 20–25 en la conversación).
- Etiqueta pública `no-implementada` en las historias del ideal sin capacidad real. Así el alumnado no reporta como defecto algo que nunca se construyó, y ninguna historia de comportamiento existente se marca.
- Los stubs con contrato observable (202 de `/forgot` y `/resend`, 501 de `/sso`) llevan además una historia ejecutable propia.
- `docs/story-discrepancies.md` guarda solo desviaciones de comportamientos que existen; las capacidades ausentes ya son públicas por la etiqueta.
- Interpreté «a{» como la opción (a); si no era eso, hay que revertir esta sección y la decisión 9.

## Lo que queda al constructor

- La lista final de épicas y el número de historias por épica.
- El lenguaje y la estructura del script de sincronización y del linter.
- Cómo comprobar los ejemplos (a mano, con scripts o con una mezcla) y si se usan subagentes en paralelo.
- El orden de las épicas después del piloto.

## Enmienda (2026-11-13, puerta del piloto)

Decisiones del usuario tras revisar el piloto `EP-LOGIN`, y convenciones que quedan en vigor. Donde contradicen el texto de arriba, mandan estas. La guía del redactor (`docs/user-stories/README.md`) las detalla.

1. **Granularidad: tope de unas 15 historias por épica** (12–16; nunca más de 16). Una historia reúne los comportamientos de un mismo tema y plataforma, con varios Esquemas del escenario, y **cada Esquema es un comportamiento**. Sustituye a «un issue = un comportamiento» y a la «granularidad máxima» (líneas 19, 56 y 196) y a «cada laguna del móvil es una historia» (línea 135): las lagunas de una pantalla pueden ir en una sola historia `no-implementada`, una por Esquema. La API sigue siendo la plataforma más atómica, dentro del tope.
2. **Estado visible en el issue publicado.** El cuerpo de cada historia lleva, tras la línea `**Id:**`, `**Estado:** vigente — la app debe cumplirlo; si no lo cumple, es un defecto.` o, con `no-implementada`, `**Estado:** capacidad futura — la app todavía no la tiene; no se prueba contra la app.`. Los archivos son la fuente del texto de los issues y definen el comportamiento correcto; no describen lo que la app hace hoy. `verificacion` sigue sin publicarse.
3. **Capacidades futuras sin diseño inventado** (matiza «describe el ideal», líneas 50 y 128): una historia `no-implementada` afirma solo lo que ya existe en otra plataforma o lo que está decidido; el resto va a una sección `## Decisiones pendientes` con al menos una viñeta («Ninguna.» si no queda nada). La comprueba la regla 17 del linter, `decisiones-pendientes` (se suma a la lista de la línea 154).
4. **Estado reproducible y autonomía.** Cada fila de Ejemplos parte de un estado inicial explícito y es independiente: un tenant propio (`alumnoNN`), reinicio con `POST /api/admin/reset` antes de cada fila y datos que no se repiten (un correo nuevo por fila para un correo sin cuenta). Una historia se prueba sin leer otra: precondiciones con datos observables, esperas con un límite explícito y sin expresiones vagas; las referencias a otras historias van solo en `relacionadas`.
5. **Aviso de cuenta desactivada:** «Tu cuenta está desactivada. Contacta con un administrador.» en web y móvil (texto fijado por el usuario).
6. **Correo sin cuenta:** requisito: se bloquea (423 `account_locked`) en el 5.º intento fallido consecutivo, igual que una cuenta real, para que ninguna respuesta revele si la cuenta existe.
7. **Mantener la sesión en el móvil:** la app móvil ya conserva la sesión al cerrarla y volver a abrirla (historia vigente); lo que le falta respecto de la web es la casilla «Mantener la sesión en este equipo». Matiza «mantener la sesión» entre los extras del login de las líneas 135 y 189.
