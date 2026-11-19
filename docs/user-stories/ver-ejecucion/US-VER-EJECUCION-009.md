---
id: US-VER-EJECUCION-009
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Móvil] Elegir evidencias con los botones de imagen y de PDF"
etiquetas: [movil]
relacionadas: [US-VER-EJECUCION-003, US-VER-EJECUCION-006, US-VER-EJECUCION-008, US-VER-EJECUCION-011, US-VER-EJECUCION-012]
verificacion: ejecutada
cubre: ["/verification/:code"]
---

## Historia
Como persona que adjunta evidencias desde el móvil, quiero elegir capturas y PDF con botones y ver si cada archivo entra,
para no enviar una ejecución que el servidor va a rechazar y poder quitar lo que no quiero antes de registrarla.

## Reglas
- Hay tres botones en el apartado «Evidencias»: «Adjuntar un archivo» (una imagen), «Adjuntar varios archivos» (hasta cinco imágenes) y «Adjuntar PDF» (uno o varios PDF). No hay ninguna zona para arrastrar archivos. Cada botón abre el selector de archivos del sistema; lo que muestra ese selector depende del sistema y no forma parte de esta historia.
- Cada archivo elegido se comprueba al añadirlo, con las mismas reglas que la web: el tipo debe ser PNG, JPEG o PDF; el tamaño no puede superar los 2 MB (exactamente 2 MB se admite); un archivo con el mismo nombre y el mismo tamaño que otro ya elegido no se añade otra vez y no genera aviso; y en total no puede haber más de 5 archivos.
- Un archivo que no pasa no entra en la lista y aparece su aviso: «<nombre>: solo se admiten PNG, JPEG o PDF», «<nombre>: supera los 2 MB» o «Máximo 5 archivos por ejecución». Los archivos válidos de la misma elección sí se añaden.
- Los archivos aceptados aparecen en «Archivos seleccionados» con su nombre y su tamaño, en B, KB o MB (por ejemplo, 1.0 KB o 2.00 MB). Una imagen muestra una vista previa; un PDF muestra el distintivo «PDF».
- Cada archivo de la lista tiene un control para quitarlo («Quitar» seguido del nombre del archivo).
- Sin archivos, la lista dice «Ningún archivo seleccionado».
- Si el selector del sistema no se puede abrir, aparece el aviso «No se pudo abrir el selector de archivos».
- Elegir o quitar archivos no envía nada al servidor: solo «Registrar ejecución» envía.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La persona entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001` sin archivos elegidos. Los archivos de cada fila son pequeños y se describen por su nombre, su tipo y su tamaño.

## Criterios de aceptación
```gherkin
Característica: Elección de evidencias con los botones del móvil

  Esquema del escenario: Una imagen elegida con el botón de un archivo se acepta o se rechaza
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar un archivo» y elige una imagen llamada <nombre> de tipo <tipo> y <tamano> bytes
    Entonces <resultado>

    Ejemplos:
      | nombre | tipo | tamano | resultado |
      | captura.png | image/png | 1.024 | aparece en «Archivos seleccionados» con el tamaño 1.0 KB y una vista previa de la imagen |
      | grande.png | image/png | 2.097.153 | no aparece en «Archivos seleccionados» y aparece el aviso «grande.png: supera los 2 MB» |

  Esquema del escenario: Un máximo de cinco imágenes por ejecución con el botón de varios archivos
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 y ya hay <ya_elegidos> imágenes PNG de 1.024 bytes elegidas, con nombres distintos
    Cuando pulsa «Adjuntar varios archivos» y elige <nuevos> imágenes PNG de 1.024 bytes, con nombres distintos de las que ya están elegidas
    Entonces <resultado>

    Ejemplos:
      | ya_elegidos | nuevos | resultado |
      | 4 | 2 | se añade solo una y aparece el aviso «Máximo 5 archivos por ejecución» |
      | 5 | 1 | no se añade ninguna y aparece el aviso «Máximo 5 archivos por ejecución» |

  Esquema del escenario: Un PDF elegido con el botón de PDF se acepta o se rechaza
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar PDF» y elige un PDF llamado <nombre> de <tamano> bytes
    Entonces <resultado>

    Ejemplos:
      | nombre | tamano | resultado |
      | informe.pdf | 1.024 | aparece en «Archivos seleccionados» con el distintivo «PDF» y el tamaño 1.0 KB |
      | informe-grande.pdf | 2.097.153 | no aparece en «Archivos seleccionados» y aparece el aviso «informe-grande.pdf: supera los 2 MB» |

  Esquema del escenario: Un archivo elegido se quita de la lista
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 y tiene elegido <nombre>
    Cuando pulsa el control para quitar <nombre>
    Entonces <nombre> deja de aparecer en «Archivos seleccionados»

    Ejemplos:
      | nombre |
      | captura.png |
```

## Fuera de alcance
- La forma en que el sistema de iOS y el de Android muestran sus selectores, y lo que se elige en ellos: historias 011 y 012 de esta épica.
- La versión web de la elección de archivos, con su zona para arrastrar: historia 006.
- Las reglas de tipo, tamaño y cantidad que aplica la API al recibir la ejecución: historia 003.
- El aviso de error que llega del servidor al enviar: historia 008.
- Registrar la ejecución y el historial: historias 008 y 010.
