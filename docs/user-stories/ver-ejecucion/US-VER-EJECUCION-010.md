---
id: US-VER-EJECUCION-010
tipo: historia
epica: EP-VER-EJECUCION
titulo: "[Móvil] Ver el historial, ampliar una imagen y descargar una evidencia"
etiquetas: [movil]
relacionadas: [US-VER-EJECUCION-004, US-VER-EJECUCION-007, US-VER-EJECUCION-008, US-VER-EJECUCION-011, US-VER-EJECUCION-012]
verificacion: codigo
cubre: ["/verification/:code"]
---

## Historia
Como persona que revisa un caso de prueba desde el móvil, quiero ver cada ejecución con sus evidencias, ampliar una captura y descargar cualquier evidencia,
para revisar la prueba visual sin salir de la app.

## Reglas
- El historial es una lista de tarjetas, una por ejecución, de la más reciente a la más antigua. Cada tarjeta muestra el identificador de la ejecución (`RUN-` seguido de tres dígitos), su fecha y su hora, su resultado con el mismo texto que el selector («Superado», «Fallido» o «Bloqueado»), sus notas (o «—» si están vacías), sus evidencias y la línea «Ejecutado por:» con el nombre de quien la registró.
- Una ejecución sin evidencias muestra «Sin evidencias».
- Una imagen (PNG o JPEG) se muestra como una miniatura identificada como «Evidencia» seguido del código del caso (por ejemplo, «Evidencia TC-001») y con su nombre, su tamaño y el botón «Descargar». Mientras la miniatura carga, muestra un indicador de carga. Si no puede cargarse, muestra una cruz y el aviso «No se pudo cargar la evidencia».
- Al tocar la miniatura de una imagen, se abre una hoja con la imagen ampliada, titulada con el nombre del archivo.
- Un PDF se muestra con un icono que lleva el distintivo «PDF», identificado como «Documento PDF» seguido de su nombre. Un PDF no tiene miniatura de imagen ni se puede ampliar.
- «Descargar» entrega la evidencia. En la versión web de la app (Expo web), abre el contenido en una pestaña nueva. Si la entrega falla, aparece el aviso emergente «No se pudo cargar la evidencia».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en `/login` sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». La persona entra como `consultor@sigpro.test` (contraseña `Consul1234!`) y abre `/verification/TC-001`.
- Datos del seed de `TC-001`: `RUN-001` (resultado «Superado», notas «Resultado conforme con el criterio de aceptación.», con la evidencia `TC-001-001.png`) y `RUN-002` (resultado «Bloqueado», notas «Ejecución bloqueada: el entorno de pruebas no estaba disponible.», sin evidencias). Ambas las registró Lucía Fernández.

## Criterios de aceptación
```gherkin
Característica: Historial de ejecuciones con evidencias en el móvil

  Esquema del escenario: Cada tarjeta muestra el resultado, las notas, las evidencias y quién la registró
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando mira la tarjeta de la ejecución <ejecucion> en el historial
    Entonces la tarjeta muestra el resultado <resultado>, las notas <notas> y, en sus evidencias, <evidencias>
    Y la tarjeta muestra «Ejecutado por: Lucía Fernández»

    Ejemplos:
      | ejecucion | resultado | notas | evidencias |
      | RUN-002 | «Bloqueado» | Ejecución bloqueada: el entorno de pruebas no estaba disponible. | «Sin evidencias» |
      | RUN-001 | «Superado» | Resultado conforme con el criterio de aceptación. | la captura TC-001-001.png |

  Esquema del escenario: Al tocar la miniatura de una imagen se abre la imagen ampliada
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando toca la miniatura de la evidencia <evidencia>
    Entonces se abre una hoja con la imagen ampliada titulada «<evidencia>»

    Ejemplos:
      | evidencia |
      | TC-001-001.png |

  Esquema del escenario: Una evidencia PDF se muestra con su distintivo y sin miniatura de imagen
    Dado que en el tenant alumno01, recién reiniciado, alumno01@sigpro.lab ha registrado con la API, en TC-001, la ejecución RUN-051 con el resultado «Fallido», las notas Adjunto informe y la evidencia informe.pdf, que es un PDF válido de 1.024 bytes; y consultor@sigpro.test ha entrado en la app móvil con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando mira la evidencia <evidencia> de la ejecución RUN-051
    Entonces ve el distintivo «PDF» con el nombre <evidencia> y el tamaño 1.0 KB
    Y no ve una miniatura de imagen para esa evidencia

    Ejemplos:
      | evidencia |
      | informe.pdf |

  Esquema del escenario: Descargar una evidencia en la versión web de la app abre su contenido en una pestaña nueva
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test ha entrado en la versión web de la app con alumno01 en «Tenant de trabajo» y tiene abierto /verification/TC-001
    Cuando pulsa «Descargar» en la evidencia de la ejecución <ejecucion>
    Entonces se abre una pestaña nueva con el contenido de <nombre>

    Ejemplos:
      | ejecucion | nombre |
      | RUN-001 | TC-001-001.png |
```

## Fuera de alcance
- La entrega de una evidencia a la hoja de compartir del sistema en iOS y en Android: historias 011 y 012 de esta épica.
- La versión web del historial, con su tabla y sus miniaturas: historia 007.
- La descarga por la API, con sus cabeceras y su 404: historia 004.
- Registrar una ejecución desde el móvil: historia 008.
- La lista de casos y la cabecera y los pasos del detalle del caso: EP-VER-CASOS.
