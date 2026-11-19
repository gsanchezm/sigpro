---
id: US-VER-EJECUCION-006
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Web] Elegir evidencias antes de enviar: tipo, tamaño, cantidad y quitarlas"
etiquetas: [web]
relacionadas: [US-VER-EJECUCION-003, US-VER-EJECUCION-005, US-VER-EJECUCION-007, US-VER-EJECUCION-009]
verificacion: ejecutada
cubre: ["/verification/:code"]
---

## Historia
Como persona que adjunta evidencias a una ejecución desde el navegador, quiero que cada archivo se compruebe en cuanto lo elijo,
para no enviar un archivo que se va a rechazar y poder quitar los que no quiero antes de registrar la ejecución.

## Reglas
- Hay tres formas de elegir archivos: «Adjuntar un archivo» (uno), «Adjuntar varios archivos» (varios, en la misma ventana) y arrastrarlos a la zona «Arrastra aquí tus evidencias». Sobre los controles aparece la pista «PNG, JPEG o PDF · máx. 2 MB por archivo · hasta 5 archivos».
- Cada archivo elegido se comprueba en este orden:
  1. Tipo: debe ser PNG, JPEG o PDF. Se mira el tipo que da el navegador o, si no lo da, la extensión `.png`, `.jpg`, `.jpeg` o `.pdf`.
  2. Tamaño: no más de 2 MB. Exactamente 2 MB se admite.
  3. Repetido: un archivo con el mismo nombre y el mismo tamaño que otro ya seleccionado no se añade otra vez y no genera ningún aviso.
  4. Cantidad: no más de 5 archivos en total.
- Un archivo que no pasa no entra en la lista y aparece su aviso: «<nombre>: solo se admiten PNG, JPEG o PDF» si el tipo no vale, «<nombre>: supera los 2 MB» si pesa demasiado, o «Máximo 5 archivos por ejecución» si ya hay cinco. Los archivos válidos de la misma selección sí se añaden.
- Cada nueva selección sustituye el aviso de la anterior.
- Los archivos aceptados aparecen en «Archivos seleccionados» con su nombre y su tamaño, en B, KB o MB con un decimal o dos (por ejemplo, 1.0 KB o 2.00 MB). Una imagen muestra una vista previa; un PDF muestra el distintivo «PDF».
- Cada archivo de la lista tiene un control para quitarlo. Al quitar un archivo se borra el aviso de archivos que estuviera visible.
- Sin archivos, la lista dice «Ningún archivo seleccionado».
- Elegir o quitar archivos no envía nada al servidor: solo el botón «Registrar ejecución» envía.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001` sin archivos seleccionados. Los archivos de cada fila son pequeños y se describen por su nombre, su tipo y su tamaño; el ejecutor los genera con esas características.

## Criterios de aceptación
```gherkin
Característica: Elección de evidencias antes de registrar una ejecución en la web

  Esquema del escenario: Cada archivo se acepta o se rechaza al elegirlo
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001 sin archivos seleccionados
    Cuando elige con «Adjuntar un archivo» un archivo llamado <nombre> de tipo <tipo> y <tamano> bytes
    Entonces <resultado>

    Ejemplos:
      | nombre | tipo | tamano | resultado |
      | captura.png | image/png | 1.024 | aparece en «Archivos seleccionados» con el tamaño 1.0 KB y una vista previa de la imagen |
      | informe.pdf | application/pdf | 1.024 | aparece en «Archivos seleccionados» con el distintivo «PDF» |
      | texto.txt | text/plain | 1.024 | no aparece en «Archivos seleccionados» y aparece el aviso «texto.txt: solo se admiten PNG, JPEG o PDF» |
      | grande.png | image/png | 2.097.153 | no aparece en «Archivos seleccionados» y aparece el aviso «grande.png: supera los 2 MB» |

  Esquema del escenario: Un máximo de cinco archivos por ejecución
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, tiene abierto /verification/TC-001 y ya hay <ya_elegidos> archivos PNG de 1.024 bytes seleccionados, con nombres distintos
    Cuando elige <nuevos> archivos PNG de 1.024 bytes, con nombres distintos de los que ya están seleccionados
    Entonces <resultado>

    Ejemplos:
      | ya_elegidos | nuevos | resultado |
      | 0 | 5 | se añaden los cinco y no aparece ningún aviso |
      | 4 | 2 | se añade solo uno y aparece el aviso «Máximo 5 archivos por ejecución» |
      | 5 | 1 | no se añade ninguno y aparece el aviso «Máximo 5 archivos por ejecución» |

  Esquema del escenario: Un archivo repetido no se añade otra vez
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, tiene abierto /verification/TC-001 y está seleccionado <nombre> de 1.024 bytes
    Cuando elige otra vez <nombre> de 1.024 bytes
    Entonces «Archivos seleccionados» sigue con un único <nombre> y no aparece ningún aviso

    Ejemplos:
      | nombre |
      | captura.png |

  Esquema del escenario: Un archivo seleccionado se quita de la lista
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01, tiene abierto /verification/TC-001, tiene seleccionados captura.png e informe.pdf, y ha elegido texto.txt de tipo text/plain, con el aviso «texto.txt: solo se admiten PNG, JPEG o PDF»
    Cuando pulsa el control para quitar <nombre>
    Entonces <nombre> deja de aparecer en «Archivos seleccionados»
    Y el aviso «texto.txt: solo se admiten PNG, JPEG o PDF» desaparece

    Ejemplos:
      | nombre |
      | captura.png |
      | informe.pdf |

  Esquema del escenario: Un archivo arrastrado a la zona se añade igual que uno elegido
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha iniciado sesión en /login?tenant=alumno01 y tiene abierto /verification/TC-001 sin archivos seleccionados
    Cuando arrastra el archivo <nombre> de tipo image/png y 1.024 bytes a la zona «Arrastra aquí tus evidencias»
    Entonces aparece en «Archivos seleccionados» con el tamaño 1.0 KB

    Ejemplos:
      | nombre |
      | captura.png |
```

## Fuera de alcance
- El rechazo que llega del servidor al enviar y su aviso en el formulario: historia 005 de esta épica.
- Las reglas de tipo, tamaño y cantidad que aplica la API: historia 003.
- Registrar la ejecución y el aviso de «Ejecución registrada»: historia 005.
- Ver las evidencias ya guardadas y descargarlas: historia 007.
- La versión móvil de la elección de archivos: historia 009.
