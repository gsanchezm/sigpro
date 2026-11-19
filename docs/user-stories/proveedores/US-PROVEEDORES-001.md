---
id: US-PROVEEDORES-001
tipo: historia
epica: EP-PROVEEDORES
titulo: "[API] Listar los proveedores del tenant con sus contratos y filtrarlos por nombre, NIF o programa"
etiquetas: [api]
relacionadas: [US-PROVEEDORES-002, US-PROVEEDORES-003, US-PROVEEDORES-004]
verificacion: codigo
cubre: ["GET /api/suppliers"]
---

## Historia
Como cliente de la API con una sesión de SIGPRO (la web, la app móvil o una suite de pruebas), quiero pedir la lista de los proveedores de mi tenant, con sus datos y sus contratos, y filtrarla por nombre o NIF y por programa,
para saber qué proveedores trabajan en un programa o localizar a uno, sin recibir proveedores de otra organización.

## Reglas
- `GET /api/suppliers` exige una sesión de acceso. Sin cabecera `Authorization` responde 401 con `code: "missing_token"`. Con una cabecera `Bearer` cuyo texto no es un token válido responde 401 con `code: "invalid_token"`.
- Cualquier rol autenticado (`admin`, `program_manager`, `consultant` y `auditor`) puede consultarla y recibe la misma lista.
- Con una sesión válida responde 200 con un array JSON de proveedores, sin envoltorio ni paginación. Cada proveedor trae `id`, `name`, `nif`, `contactEmail`, `approved` (`true` o `false`) y `contracts`.
- Cada contrato trae `programCode`, `programName` (el nombre del programa), `amountEur` (importe en euros, número entero) y `signedAt` (fecha `AAAA-MM-DD`).
- Los proveedores van ordenados por nombre, en el orden alfabético del español. Los contratos de cada proveedor van ordenados por código de programa.
- Sin filtros, la lista trae todos los proveedores del tenant, y cada uno trae todos sus contratos.
- `q` busca en el nombre y en el NIF, sin distinguir mayúsculas; los espacios del principio y del final de `q` no cuentan. El correo de contacto no se busca. Un `q` vacío o formado solo por espacios no filtra. Si ningún proveedor cumple el texto, responde 200 con un array vacío.
- `program` deja solo los proveedores con al menos un contrato con ese programa. Un `program` vacío no filtra. Un programa sin contratos responde 200 con un array vacío.
- Si `q` y `program` van juntos, un proveedor aparece solo si cumple los dos.
- El filtro por `program` no recorta los contratos: el proveedor trae todos sus contratos, también los de otros programas.
- Aislamiento: la lista sale del tenant del token de sesión. La cabecera `x-tenant` no cambia el tenant de una petición con token.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Las cuentas de la fila inician sesión con `POST /api/auth/login` y la cabecera `x-tenant` de su tenant, y usan su `accessToken` como `Authorization: Bearer`. Las contraseñas son las del seed: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`). Las filas de aislamiento reinician también `alumno02` con el token de `alumno02@sigpro.lab`, y borran el programa PRG-003 en `alumno01` con `DELETE /api/programs/PRG-003` y el token de `alumno01@sigpro.lab`; en `alumno02` no se borra nada. Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Lista de proveedores del tenant por la API

  Esquema del escenario: Sin una sesión válida la API no entrega la lista
    Dado que en el tenant alumno01, recién reiniciado, un cliente de la API prepara GET /api/suppliers con <cabecera_authorization>
    Cuando la envía con la cabecera x-tenant alumno01
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | cabecera_authorization | respuesta |
      | (sin cabecera) | 401 missing_token |
      | (Bearer con un texto que no es un token) | 401 invalid_token |

  Esquema del escenario: La lista trae los seis proveedores del seed ordenados por nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers sin filtros
    Entonces la respuesta es 200 con seis proveedores
    Y el proveedor en el lugar <lugar> es <nombre>, con id <id>, NIF <nif> y aprobado <aprobado>

    Ejemplos:
      | lugar | nombre | id | nif | aprobado |
      | 1 | Aeronáutica Levante S.L. | s1 | B11111111 | true |
      | 2 | Cibertáctica Norte | s5 | B15555555 | false |
      | 3 | Electrónica del Cantábrico | s3 | B13333333 | true |
      | 4 | Logística Marítima Atlas | s6 | B16666666 | true |
      | 5 | Optrónica Meseta S.L. | s4 | B14444444 | true |
      | 6 | Sistemas Ibéricos S.A. | s2 | B12222222 | true |

  Esquema del escenario: Cada proveedor trae sus contratos con su programa, su importe y su fecha de firma
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers sin filtros
    Entonces el proveedor <proveedor> tiene el contrato con <programa>, con el nombre de programa <nombre_programa>, importe <importe> y fecha de firma <fecha>

    Ejemplos:
      | proveedor | programa | nombre_programa | importe | fecha |
      | Aeronáutica Levante S.L. | PRG-002 | Radar de vigilancia costera RVC-2 | 150000 | 2025-01-15 |
      | Cibertáctica Norte | PRG-010 | Suite de guerra electrónica SGE | 350000 | 2025-05-15 |
      | Logística Marítima Atlas | PRG-011 | Defensa antiaérea de corto alcance | 400000 | 2025-06-15 |

  Esquema del escenario: Cualquier rol autenticado recibe la misma lista
    Dado que en el tenant alumno01, recién reiniciado, <cuenta>, con el rol <rol>, ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers sin filtros
    Entonces la respuesta es 200 con seis proveedores, y el primero es Aeronáutica Levante S.L.

    Ejemplos:
      | cuenta | rol |
      | alumno01@sigpro.lab | admin |
      | gestor@sigpro.test | program_manager |
      | consultor@sigpro.test | consultant |
      | auditor@sigpro.test | auditor |

  Esquema del escenario: El filtro q busca en el nombre o en el NIF
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers con q <texto>
    Entonces la respuesta es 200 con <resultado>

    Ejemplos:
      | texto | resultado |
      | IBÉRICOS | solo Sistemas Ibéricos S.A. |
      | b1555 | solo Cibertáctica Norte, por su NIF B15555555 |
      | B1111111 | solo Aeronáutica Levante S.L. |
      | B11111111 | solo Aeronáutica Levante S.L. |
      | (s.l. con espacios delante y detrás) | Aeronáutica Levante S.L. y Optrónica Meseta S.L., en ese orden |
      | ÓN | Electrónica del Cantábrico y Optrónica Meseta S.L., en ese orden |
      | B111111111 | una lista vacía |
      | zzzzzz | una lista vacía |
      | (vacío) | los seis proveedores |
      | (tres espacios) | los seis proveedores |

  Esquema del escenario: El filtro program deja los proveedores con contrato en ese programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers con program <programa> y q <texto>
    Entonces la respuesta es 200 con <resultado>

    Ejemplos:
      | programa | texto | resultado |
      | PRG-001 | (vacío) | solo Aeronáutica Levante S.L. |
      | PRG-010 | (vacío) | solo Cibertáctica Norte |
      | PRG-012 | (vacío) | solo Logística Marítima Atlas |
      | PRG-003 | ibéricos | solo Sistemas Ibéricos S.A. |
      | PRG-001 | ibéricos | una lista vacía |
      | PRG-013 | (vacío) | una lista vacía |
      | (vacío) | (vacío) | los seis proveedores |

  Esquema del escenario: El filtro por programa no recorta los contratos del proveedor
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la API con x-tenant alumno01
    Cuando pide GET /api/suppliers con program <programa>
    Entonces el proveedor <proveedor> trae sus dos contratos, con los programas <contratos>

    Ejemplos:
      | programa | proveedor | contratos |
      | PRG-001 | Aeronáutica Levante S.L. | PRG-001 y PRG-002 |
      | PRG-010 | Cibertáctica Norte | PRG-009 y PRG-010 |

  Esquema del escenario: La lista sale del tenant del token y no de la cabecera x-tenant
    Dado que en los tenants alumno01 y alumno02, recién reiniciados, se ha borrado PRG-003 en alumno01, y <cuenta> ha iniciado sesión en la API en su propio tenant
    Cuando pide GET /api/suppliers con program PRG-003 y la cabecera x-tenant <cabecera>
    Entonces la respuesta es 200 con <resultado>

    Ejemplos:
      | cuenta | cabecera | resultado |
      | alumno01@sigpro.lab | alumno01 | una lista vacía |
      | alumno01@sigpro.lab | alumno02 | una lista vacía |
      | alumno02@sigpro.lab | alumno02 | solo Sistemas Ibéricos S.A. |
```

## Fuera de alcance
- Cómo se muestran los proveedores en la web y en la app móvil: esta misma épica, en sus historias de web y de app móvil.
- Dar de alta, editar o eliminar proveedores, y asignar o quitar contratos de un programa: ninguna épica lo cubre todavía.
- La ficha del programa, su ruta y sus pestañas: EP-PROG-DETALLE.
- El inicio de sesión y la duración del token: EP-LOGIN y EP-SESION.

## Decisiones pendientes
- Si `q` debe ignorar las tildes. Hoy «ibericos» no encuentra a Sistemas Ibéricos S.A. y «ibéricos» sí lo encuentra. Hasta que se decida, ninguna fila lo afirma.
- Si `q` necesita un número mínimo de caracteres. Hoy basta una letra; la búsqueda global de la cabecera exige dos.
- Qué responde `program` cuando el código no es un programa del tenant. Hoy responde 200 con un array vacío, igual que un programa sin contratos; no está decidido si debe responder 404.
