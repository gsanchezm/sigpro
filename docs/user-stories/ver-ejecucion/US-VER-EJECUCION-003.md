---
id: US-VER-EJECUCION-003
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[API] Validar las evidencias de una ejecución: tipo real, tamaño y cantidad"
etiquetas: [api]
relacionadas: [US-VER-EJECUCION-001, US-VER-EJECUCION-002, US-VER-EJECUCION-004, US-VER-EJECUCION-006]
verificacion: ejecutada
cubre: ["POST /api/test-cases/:code/runs"]
---

## Historia
Como cliente de la API que registra una ejecución con capturas o documentos, quiero que cada archivo se compruebe por su contenido real, su tamaño y el número de archivos,
para que una evidencia que no es una captura, un PDF o un archivo dentro del límite no se guarde, y que el rechazo me diga qué archivo no vale.

## Reglas
- Las evidencias van en el campo `files` del `multipart/form-data`, un archivo por parte. Una ejecución admite hasta 5.
- El tipo se comprueba por el contenido, no por el nombre. Un archivo es válido si su tipo declarado es `image/png`, `image/jpeg` o `application/pdf` y sus primeros bytes son la firma de ese mismo tipo (PNG, JPEG o `%PDF-`). Si no lo es, responde 422 `validation_failed` con `errors.files: fileBadTypeServer`.
- El tamaño máximo es de 2 MB (2.097.152 bytes) por archivo. Exactamente 2 MB se admite. Un archivo de más de 2 MB y de hasta 5 MB responde 422 con `errors.files: fileTooBigServer`.
- Un archivo de más de 5 MB (5.242.880 bytes) lo corta el servidor antes de validarlo y responde 413 con el mensaje `File too large`. Esa respuesta no trae `code` ni `errors`.
- La cantidad: de 1 a 5 archivos se admiten. Con 6 a 10, la respuesta es 422 con `errors.files: tooManyFiles`. Con más de 10 archivos en la misma petición, la respuesta es 400 con el mensaje `Too many files`, sin `code` ni `errors`.
- Las comprobaciones de los archivos van en este orden: primero la cantidad, después el tipo de todos los archivos y, por último, el tamaño de todos. Por eso un archivo de tipo no válido aunque otro sea demasiado grande responde 422 `fileBadTypeServer`.
- La comprobación del caso va antes que la de los archivos: con un código de caso que no existe en el tenant, la respuesta es 404 aunque los archivos no sean válidos.
- Un rechazo por archivos (422, 413 o 400) no crea la ejecución ni ninguna evidencia: el siguiente número libre sigue siendo `RUN-051` y `EV-014`.
- Una ejecución aceptada guarda cada archivo con su nombre sin la ruta: `C:\Users\yo\captura.png` queda como `captura.png`, y `../../captura.png` también. Cada evidencia se numera con el siguiente `EV-` libre del tenant, consecutivo y en el orden en que llegan los archivos: con el seed, `EV-014`, después `EV-015`, y así hasta `EV-018`.
- Cada evidencia guardada conserva el tipo real del archivo en `mimeType` y su tamaño en bytes en `size`.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La cuenta `alumno01@sigpro.lab` inicia sesión con `POST /api/auth/login` y la cabecera `x-tenant: alumno01`, y usa su `accessToken` como `Authorization: Bearer`. Los archivos de cada fila son pequeños y se describen por su nombre, su tipo declarado y su contenido: un PNG válido, un JPEG válido, un PDF válido, un GIF válido o un texto plano, con el tamaño que indique la fila. El ejecutor los genera con esas características.

## Criterios de aceptación
```gherkin
Característica: Validación de las evidencias de una ejecución por la API

  Esquema del escenario: El tipo se comprueba por el contenido real del archivo
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y un único archivo <archivo> de tipo <tipo> cuyo contenido es <contenido>
    Entonces la respuesta es <respuesta>
    Y <evidencia>

    Ejemplos:
      | archivo | tipo | contenido | respuesta | evidencia |
      | captura.png | image/png | un PNG válido de 1.024 bytes | 201 con una evidencia EV-014 | la evidencia queda con el tipo image/png |
      | foto.jpg | image/jpeg | un JPEG válido de 1.024 bytes | 201 con una evidencia EV-014 | la evidencia queda con el tipo image/jpeg |
      | informe.pdf | application/pdf | un PDF válido de 1.024 bytes | 201 con una evidencia EV-014 | la evidencia queda con el tipo application/pdf |
      | texto.txt | text/plain | un texto plano de 1.024 bytes | 422 validation_failed con el motivo fileBadTypeServer en files | no se guarda ninguna evidencia |
      | falso.png | image/png | un texto plano de 1.024 bytes | 422 validation_failed con el motivo fileBadTypeServer en files | no se guarda ninguna evidencia |
      | mal.png | image/png | un JPEG válido de 1.024 bytes | 422 validation_failed con el motivo fileBadTypeServer en files | no se guarda ninguna evidencia |

  Esquema del escenario: El tamaño se comprueba con el límite de 2 MB y con el límite de transporte de 5 MB
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y un único PNG válido llamado <archivo> de <tamano>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | archivo | tamano | respuesta |
      | limite.png | 2.097.151 bytes | 201 con una evidencia EV-014 |
      | limite.png | 2.097.152 bytes (2 MB exactos) | 201 con una evidencia EV-014 |
      | limite.png | 2.097.153 bytes | 422 validation_failed con el motivo fileTooBigServer en files |
      | grande.png | 3.145.728 bytes | 422 validation_failed con el motivo fileTooBigServer en files |
      | enorme.png | 5.242.881 bytes | 413 con el mensaje File too large |

  Esquema del escenario: La cantidad de archivos se limita a cinco
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y <archivos>
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | archivos | respuesta |
      | 4 PNG válidos de 1.024 bytes cada uno, con nombres distintos | 201 con cuatro evidencias, de EV-014 a EV-017 |
      | 5 PNG válidos de 1.024 bytes cada uno, con nombres distintos | 201 con cinco evidencias, de EV-014 a EV-018 |
      | 6 PNG válidos de 1.024 bytes cada uno, con nombres distintos | 422 validation_failed con el motivo tooManyFiles en files |
      | 11 PNG válidos de 1.024 bytes cada uno, con nombres distintos | 400 con el mensaje Too many files |

  Esquema del escenario: El nombre guardado no incluye la ruta del archivo enviado
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y un único PNG válido de 1.024 bytes llamado <nombre_enviado>
    Entonces la evidencia EV-014 queda guardada con el nombre <nombre_guardado>

    Ejemplos:
      | nombre_enviado | nombre_guardado |
      | C:\Users\yo\captura.png | captura.png |
      | ../../captura.png | captura.png |

  Esquema del escenario: Un rechazo por archivos no deja ejecución ni evidencias
    Dado que en el tenant alumno01, recién reiniciado, TC-001 tiene 2 ejecuciones y alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/TC-001/runs con el campo result pass y <archivos_rechazados>
    Y después envía POST /api/test-cases/TC-001/runs con el campo result pass y un único PNG válido de 1.024 bytes llamado captura.png
    Entonces la primera respuesta es <respuesta_rechazo>
    Y la última respuesta es 201 con id RUN-051 y una evidencia EV-014 llamada captura.png
    Y el caso TC-001 tiene 3 ejecuciones

    Ejemplos:
      | archivos_rechazados | respuesta_rechazo |
      | 6 PNG válidos de 1.024 bytes cada uno, con nombres distintos | 422 validation_failed con el motivo tooManyFiles en files |
      | un PNG válido de 5.242.881 bytes | 413 con el mensaje File too large |
      | un texto plano de 1.024 bytes llamado texto.txt de tipo text/plain | 422 validation_failed con el motivo fileBadTypeServer en files |

  Esquema del escenario: El caso se busca antes que los archivos
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la API con x-tenant alumno01
    Cuando envía POST /api/test-cases/<caso>/runs con el campo result pass y un texto plano de 1.024 bytes llamado texto.txt de tipo text/plain
    Entonces la respuesta es <respuesta>

    Ejemplos:
      | caso | respuesta |
      | TC-999 | 404 test_case_not_found |
      | TC-001 | 422 validation_failed con el motivo fileBadTypeServer en files |
```

## Fuera de alcance
- El permiso y el orden general de los rechazos (401, 403 y el resultado): historia 001 de esta épica.
- El resultado, las notas y el efecto de una ejecución aceptada: historia 002.
- La descarga de una evidencia guardada: historia 004.
- Cómo se eligen los archivos en la web y en el móvil, con sus avisos antes de enviar: historias 006, 009, 011 y 012.
