---
id: US-VER-EJECUCION-011
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[iOS] Elegir evidencias con el selector de iOS y entregar una descarga a la hoja de compartir"
etiquetas: [ios]
relacionadas: [US-VER-EJECUCION-009, US-VER-EJECUCION-010, US-VER-EJECUCION-012]
verificacion: pendiente-nativo
cubre: ["/verification/:code"]
---

## Historia
Como persona que adjunta evidencias desde un iPhone, quiero elegir capturas y PDF con los selectores de iOS, y compartir una evidencia descargada con la hoja de compartir de iOS,
para adjuntar lo que tengo en el teléfono y guardar una copia donde me sirva.

## Reglas
- «Adjuntar un archivo» abre el selector de fotos de iOS con una sola selección. «Adjuntar varios archivos» lo abre con hasta cinco. «Adjuntar PDF» abre el selector de documentos de iOS, limitado a documentos PDF.
- Lo que el selector entrega como nombre, tipo y tamaño es lo que se comprueba al añadir el archivo: el tipo debe ser PNG, JPEG o PDF; no puede superar los 2 MB; un archivo con el mismo nombre y tamaño que otro ya elegido no se añade otra vez; y no puede haber más de cinco en total.
- Cancelar un selector no cambia la lista de «Archivos seleccionados» y no muestra ningún aviso.
- «Descargar» en una evidencia del historial prepara una copia temporal del archivo con el nombre de la evidencia y abre la hoja de compartir de iOS con esa copia.
- Preparación: la prueba se hace en un iPhone o en un Simulador de iOS con la app instalada. Se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La persona entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001`. Las fotos y los PDF que se eligen son pequeños y tienen el nombre y el tamaño que indica cada fila.

## Criterios de aceptación
```gherkin
Característica: Elección de evidencias y entrega de una descarga en iOS

  Esquema del escenario: Una imagen elegida en el selector de fotos se acepta o se rechaza
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de iOS con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar un archivo» y elige en el selector de fotos la imagen <nombre> de <tamano>
    Entonces <resultado>

    Ejemplos:
      | nombre | tamano | resultado |
      | captura.png | 1.024 bytes | aparece en «Archivos seleccionados» con su nombre y el tamaño 1.0 KB |
      | foto-grande.jpg | 2.097.153 bytes | no aparece en «Archivos seleccionados» y aparece el aviso «foto-grande.jpg: supera los 2 MB» |

  Esquema del escenario: El selector de varias fotos no deja elegir más de cinco
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de iOS con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar varios archivos» y elige en el selector de fotos <elegidas> imágenes PNG de 1.024 bytes
    Entonces <resultado>

    Ejemplos:
      | elegidas | resultado |
      | 5 | aparecen en «Archivos seleccionados» las cinco y no aparece ningún aviso |
      | 6 | el selector no permite elegir la sexta y aparecen en «Archivos seleccionados» solo cinco |

  Esquema del escenario: El selector de documentos solo ofrece PDF
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de iOS con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar PDF» y abre el selector de documentos
    Entonces <resultado>

    Ejemplos:
      | resultado |
      | el selector ofrece informe.pdf de 1.024 bytes y, al elegirlo, aparece en «Archivos seleccionados» con el distintivo «PDF» |

  Esquema del escenario: Cancelar un selector no cambia la lista
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de iOS con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa <boton> y cierra el selector sin elegir nada
    Entonces «Archivos seleccionados» sigue con «Ningún archivo seleccionado» y no aparece ningún aviso

    Ejemplos:
      | boton |
      | «Adjuntar un archivo» |

  Esquema del escenario: Descargar una evidencia abre la hoja de compartir de iOS con el archivo
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de iOS con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 y ve en el historial la evidencia <evidencia> de la ejecución RUN-001
    Cuando pulsa «Descargar» en esa evidencia
    Entonces se abre la hoja de compartir de iOS con un archivo llamado <evidencia>

    Ejemplos:
      | evidencia |
      | TC-001-001.png |
```

## Fuera de alcance
- La misma elección de evidencias en Android, con sus propios selectores: historia 012 de esta épica.
- Las reglas de tipo, tamaño y cantidad que se aplican en la pantalla del móvil: historia 009.
- La entrega de una evidencia en la versión web de la app: historia 010.
- La lista de casos y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.

## Decisiones pendientes
- Qué tipo y qué nombre entrega el selector de fotos de iOS para una foto que no es PNG ni JPEG (por ejemplo, una foto guardada en HEIC), y si la app debe convertirla a JPEG antes de adjuntarla o rechazarla con el aviso de tipo. No está decidido ni comprobado en un dispositivo.
