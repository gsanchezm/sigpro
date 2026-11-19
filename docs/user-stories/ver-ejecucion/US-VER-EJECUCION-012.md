---
id: US-VER-EJECUCION-012
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Android] Elegir evidencias con el selector de Android y entregar una descarga a la hoja de compartir"
etiquetas: [android]
relacionadas: [US-VER-EJECUCION-009, US-VER-EJECUCION-010, US-VER-EJECUCION-011]
verificacion: pendiente-nativo
cubre: ["/verification/:code"]
---

## Historia
Como persona que adjunta evidencias desde un teléfono Android, quiero elegir capturas y PDF con los selectores de Android, y compartir una evidencia descargada con la hoja de compartir de Android,
para adjuntar lo que tengo en el teléfono y guardar una copia donde me sirva.

## Reglas
- «Adjuntar un archivo» abre el selector de imágenes de Android con una sola selección. «Adjuntar varios archivos» lo abre con hasta cinco. «Adjuntar PDF» abre el selector de documentos de Android, limitado a documentos PDF.
- Cuando el selector da el tipo del archivo, se usa ese tipo. Cuando no lo da, el tipo se deduce de la extensión del nombre o de la ruta del archivo (`.png`, `.jpg`, `.jpeg` o `.pdf`). Cuando el selector no da el tamaño, el archivo se añade sin mostrar tamaño, y el servidor lo comprueba al enviar.
- Lo que resulte de esa lectura se comprueba así: el tipo debe ser PNG, JPEG o PDF; no puede superar los 2 MB; un archivo con el mismo nombre y tamaño que otro ya elegido no se añade otra vez; y no puede haber más de cinco en total.
- Cancelar un selector no cambia la lista de «Archivos seleccionados» y no muestra ningún aviso.
- «Descargar» en una evidencia del historial prepara una copia temporal del archivo con el nombre de la evidencia y abre la hoja de compartir de Android con esa copia.
- Preparación: la prueba se hace en un teléfono Android o en un emulador de Android con la app instalada. Se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La persona entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001`. Las imágenes y los PDF que se eligen son pequeños y tienen el nombre y el tamaño que indica cada fila.

## Criterios de aceptación
```gherkin
Característica: Elección de evidencias y entrega de una descarga en Android

  Esquema del escenario: Una imagen elegida en el selector de imágenes se añade según su nombre y su tipo
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de Android con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar un archivo» y elige en el selector de imágenes la imagen <nombre>, con el tipo <tipo_del_selector>
    Entonces <resultado>

    Ejemplos:
      | nombre | tipo_del_selector | resultado |
      | captura.png | image/png | aparece en «Archivos seleccionados» con su nombre y el tamaño 1.0 KB |
      | IMG_0001.JPG | (sin tipo) | aparece en «Archivos seleccionados» con su nombre, y su tipo se toma de la extensión JPG |

  Esquema del escenario: El selector de varias imágenes no deja elegir más de cinco
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de Android con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar varios archivos» y elige en el selector de imágenes <elegidas> imágenes PNG de 1.024 bytes
    Entonces <resultado>

    Ejemplos:
      | elegidas | resultado |
      | 5 | aparecen en «Archivos seleccionados» las cinco y no aparece ningún aviso |
      | 6 | el selector no permite elegir la sexta y aparecen en «Archivos seleccionados» solo cinco |

  Esquema del escenario: El selector de documentos solo ofrece PDF
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de Android con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa «Adjuntar PDF» y abre el selector de documentos
    Entonces <resultado>

    Ejemplos:
      | resultado |
      | el selector ofrece informe.pdf de 1.024 bytes y, al elegirlo, aparece en «Archivos seleccionados» con el distintivo «PDF» |

  Esquema del escenario: Cancelar un selector no cambia la lista
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de Android con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 sin archivos elegidos
    Cuando pulsa <boton> y cierra el selector sin elegir nada
    Entonces «Archivos seleccionados» sigue con «Ningún archivo seleccionado» y no aparece ningún aviso

    Ejemplos:
      | boton |
      | «Adjuntar un archivo» |

  Esquema del escenario: Descargar una evidencia abre la hoja de compartir de Android con el archivo
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil de Android con alumno01 en «Tenant de trabajo», tiene abierto /verification/TC-001 y ve en el historial la evidencia <evidencia> de la ejecución RUN-001
    Cuando pulsa «Descargar» en esa evidencia
    Entonces se abre la hoja de compartir de Android con un archivo llamado <evidencia>

    Ejemplos:
      | evidencia |
      | TC-001-001.png |
```

## Fuera de alcance
- La misma elección de evidencias en iOS, con sus propios selectores: historia 011 de esta épica.
- Las reglas de tipo, tamaño y cantidad que se aplican en la pantalla del móvil: historia 009.
- La entrega de una evidencia en la versión web de la app: historia 010.
- La lista de casos y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.

## Decisiones pendientes
- Qué pasa con un archivo que el selector de Android entrega sin tipo y sin una extensión reconocible en su nombre o en su ruta. Hoy la app lo rechaza en el teléfono con el aviso de tipo, con un nombre genérico (por ejemplo, `evidencia-1.bin`), sin enviarlo al servidor. No está decidido si debe rechazarse en el teléfono o enviarse para que lo valide el servidor. No está comprobado en un dispositivo.
