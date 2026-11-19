---
id: US-NAVEGACION-001
tipo: historia
epica: EP-NAVEGACION
titulo: "[API] Buscar en el tenant y devolver solo los grupos con resultados"
etiquetas: [api]
relacionadas: [US-NAVEGACION-002, US-NAVEGACION-003, US-NAVEGACION-007, US-DOC-RESTRINGIDOS-004]
verificacion: codigo
cubre: ["GET /api/search"]
---

## Historia
Como cliente de la API (la web, la app móvil o una suite de pruebas), quiero buscar un texto en los datos de mi tenant y recibir los resultados agrupados por tipo, cada uno con su enlace,
para mostrar una búsqueda global sin pedir por separado cada lista.

## Reglas
- `GET /api/search?q=<texto>` busca el texto como parte de cada campo, sin distinguir mayúsculas de minúsculas. Los campos son: en los programas, el código, el nombre y la descripción; en los requisitos, el código, el título y la descripción; en los casos de prueba, el código y el título; en las no conformidades, el código y la descripción; y en los documentos, el identificador y el título.
- Las descripciones de los requisitos y de las no conformidades se buscan en texto plano, sin sus etiquetas HTML. Un texto que solo coincide con el nombre de una etiqueta no encuentra nada.
- La respuesta tiene `query`, que es el texto recortado de espacios al principio y al final, y `groups`. `groups` contiene un grupo por cada tipo que tiene coincidencias, en este orden fijo: programas (`program`), requisitos (`requirement`), casos de prueba (`testcase`), no conformidades (`nc`) y documentos (`document`). Un tipo sin coincidencias no aparece. Si ningún tipo tiene coincidencias, `groups` es una lista vacía.
- Cada grupo trae `total`, que cuenta todas sus coincidencias, y `items`, que trae como mucho cinco, ordenados por código o por identificador de menor a mayor.
- Cada elemento trae `id`, `title`, `subtitle` y `href`:
  - programa: `id` es el código, `title` el nombre, `subtitle` el nombre del responsable y `href` `/programs/<código>`;
  - requisito: `id` es el código, `title` el título, `subtitle` el código de su programa y `href` `/programs/<código del programa>/requirements?select=<código>`;
  - caso de prueba: `id` es el código, `title` el título, `subtitle` el código de su programa y `href` `/verification/<código>`;
  - no conformidad: `id` es el código; `title` es su descripción en texto plano si tiene 90 caracteres o menos, y si tiene más, sus primeros 89 caracteres sin espacios sobrantes al final, seguidos de «…»; `subtitle` el código de su programa y `href` `/nc/<código>`;
  - documento: `id` es el identificador, `title` el título, `subtitle` el código de su programa y `href` `/documents/<identificador>`.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de cada fila obtiene su acceso con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`. Los datos son los del seed, sin ningún cambio.

## Criterios de aceptación
```gherkin
Característica: Búsqueda global en la API

  Esquema del escenario: La búsqueda agrupa los resultados por tipo, en un orden fijo y con su total
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> tiene un acceso válido
    Cuando pide GET /api/search con q <texto>
    Entonces la respuesta es 200 y sus grupos son <grupos>

    Ejemplos:
      | cuenta | texto | grupos |
      | gestor@sigpro.test | PRG-001 | programa con total 1 (PRG-001) y documento con total 2 (DOC-001 y DOC-002) |
      | gestor@sigpro.test | prg-001 | programa con total 1 (PRG-001) y documento con total 2 (DOC-001 y DOC-002) |
      | consultor@sigpro.test | PRG-003 | programa con total 1 (PRG-003) y documento con total 1 (DOC-005) |
      | gestor@sigpro.test | PRG-003 | programa con total 1 (PRG-003) y documento con total 2 (DOC-005 y DOC-006) |
      | gestor@sigpro.test | subsistema | requisito con total 40 y 5 elementos (REQ-001 a REQ-005) |
      | gestor@sigpro.test | REQ-03 | requisito con total 10 y 5 elementos (REQ-030 a REQ-034) |
      | gestor@sigpro.test | verificar | caso de prueba con total 25 y 5 elementos (TC-001 a TC-005) |
      | gestor@sigpro.test | criterio | no conformidad con total 12 y 5 elementos (NC-001 a NC-005) |
      | gestor@sigpro.test | strong | (ninguno) |
      | gestor@sigpro.test | zzz-sin-coincidencias | (ninguno) |

  Esquema del escenario: Cada resultado trae su título, su subtítulo y su enlace
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene un acceso válido
    Cuando pide GET /api/search con q <texto>
    Entonces el elemento <id> del grupo <tipo> trae el título <titulo>, el subtítulo <subtitulo> y el enlace <href>

    Ejemplos:
      | texto | tipo | id | titulo | subtitulo | href |
      | PRG-001 | program | PRG-001 | Sistema de mando táctico Ártemis | Marta Ruiz | /programs/PRG-001 |
      | PRG-001 | document | DOC-002 | Especificación técnica PRG-001 | PRG-001 | /documents/DOC-002 |
      | REQ-03 | requirement | REQ-030 | Redundancia del subsistema 030 | PRG-003 | /programs/PRG-003/requirements?select=REQ-030 |
      | verificar | testcase | TC-001 | Verificar disponibilidad (caso 001) | PRG-001 | /verification/TC-001 |
      | criterio | nc | NC-001 | Desviación detectada en la ejecución 001: el resultado no cumple el criterio de aceptació… | PRG-001 | /nc/NC-001 |
      | ccm | program | PRG-005 | Centro de control de misión CCM | Carmen Vidal | /programs/PRG-005 |
```

## Fuera de alcance
- La longitud mínima del texto y su 422: US-NAVEGACION-002.
- El acceso válido y el aislamiento por tenant: US-NAVEGACION-003.
- Los documentos restringidos dentro del grupo de documentos: US-DOC-RESTRINGIDOS-004.
- Cómo se ven los resultados en la web y en la app móvil: US-NAVEGACION-007 y US-NAVEGACION-012.

## Decisiones pendientes
- Si la búsqueda ignora las tildes. Hoy «artemis» no encuentra «Ártemis», que es el nombre de PRG-001.
- Si un texto con varias palabras debe buscarse palabra a palabra. Hoy el texto entero debe aparecer tal cual, con sus espacios.
