---
id: US-CAOS-RESET-012
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Web] Contraejemplos y preguntas frecuentes de /lab"
etiquetas: [web]
relacionadas: [US-CAOS-RESET-008, US-CAOS-RESET-010, US-CAOS-RESET-015]
verificacion: codigo
---

## Historia
Como alumno que aprende a escribir pruebas estables, quiero ver en /lab los contraejemplos que muestran por qué algunos elementos son frágiles y las preguntas frecuentes desplegables,
para entender los errores típicos y resolver mis dudas sobre el laboratorio.

## Reglas
- La sección «Contraejemplos» tiene tres bloques.
- Primer bloque: una tabla de tres filas con los códigos PRG-003, PRG-004 y PRG-005, cada una con «…» en la segunda columna. Debajo, una explicación de por qué esa forma de encontrar la fila es frágil (si cambian el orden o una columna, apunta a otra fila) y de cuál es la alternativa recomendada, que busca la fila por su texto.
- Segundo bloque: «Textos que se solapan a propósito», con los botones «Guardar» y «Guardar y cerrar». Pulsar uno muestra un aviso de éxito cuyo título es el texto de ese botón. Las insignias «Activo» y «Activo (3)» no cambian.
- Tercer bloque: «Textos que cambian con el modo caos», con un botón de ejemplo que muestra «Guardar» o «Guardar cambios» según el modo caos, la insignia «Caos activo: el texto del botón alterna» o «Caos apagado: el texto no cambia», y una explicación de cuándo alterna el botón. Pulsar el botón muestra el aviso «Guardado».
- El botón de ejemplo alterna solo si el tenant tiene guardados los textos variables y hay una sesión iniciada, porque la configuración se lee al iniciar sesión y se vuelve a leer tras aplicar el caos. Sin sesión, el botón muestra siempre «Guardar» y la insignia dice «Caos apagado: el texto no cambia», aunque el tenant tenga el caos encendido.
- La sección «Preguntas frecuentes» tiene ocho preguntas. Cada pregunta se despliega al pulsarla, con el signo «+», y se pliega con el signo «−». Solo una respuesta puede estar abierta a la vez: al abrir una, la anterior se pliega.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en el navegador salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Contraejemplos y preguntas frecuentes de /lab

  Esquema del escenario: Cada botón del bloque de solapamiento muestra su propio aviso
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y una persona sin sesión iniciada está en /lab
    Cuando pulsa <boton> en el bloque de textos que se solapan a propósito
    Entonces ve el aviso de éxito con el título <boton>

    Ejemplos:
      | boton |
      | «Guardar» |
      | «Guardar y cerrar» |

  Esquema del escenario: El botón de ejemplo alterna solo con una sesión iniciada
    Dado que el tenant alumno01, recién reiniciado y con el modo caos apagado, tiene guardados con PATCH los textos de botón variables, y una persona <situacion> ha abierto /lab
    Cuando observa el botón de ejemplo del bloque de textos que cambian con el modo caos
    Entonces el botón <comportamiento> y la insignia muestra <insignia>

    Ejemplos:
      | situacion | comportamiento | insignia |
      | sin sesión iniciada | muestra siempre «Guardar» | «Caos apagado: el texto no cambia» |
      | con sesión iniciada de alumno01@sigpro.lab | alterna entre «Guardar» y «Guardar cambios» | «Caos activo: el texto del botón alterna» |

  Esquema del escenario: Cada pregunta frecuente despliega su respuesta
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y una persona sin sesión iniciada está en /lab
    Cuando pulsa la pregunta <pregunta>
    Entonces se despliega una respuesta que contiene <fragmento>

    Ejemplos:
      | pregunta | fragmento |
      | «¿Cómo reinicio mis datos?» | «Con el botón de reinicio de esta página» |
      | «¿Cómo cambio de tenant?» | «Con el selector de esta página» |
      | «¿Dónde está la documentación de la API?» | «En /api/docs (Swagger UI).» |
      | «¿Qué código MFA uso?» | «pide un segundo paso: 123456» |
      | «¿Por qué mi cuenta aparece bloqueada?» | «Cinco contraseñas incorrectas seguidas bloquean la cuenta (423).» |
      | «¿Cómo apunto mi suite a este entorno?» | «del proyecto de ejemplo» |
      | «¿Qué hace el modo caos?» | «Añade latencia aleatoria, errores 500 en las escrituras» |
      | «¿Cómo descargo el proyecto de ejemplo?» | (describe: indica el enlace del material de ejemplo) |

  Esquema del escenario: Abrir una pregunta pliega la que estaba abierta
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y una persona sin sesión iniciada está en /lab con la pregunta «¿Cómo reinicio mis datos?» desplegada
    Cuando pulsa la pregunta <pregunta>
    Entonces la respuesta de «¿Cómo reinicio mis datos?» queda plegada y la de la pregunta pulsada queda desplegada

    Ejemplos:
      | pregunta |
      | «¿Cómo cambio de tenant?» |
```

## Fuera de alcance
- El botón de reinicio y su confirmación: historia 009 de esta épica.
- El modo caos y sus controles: historia 010 de esta épica.
- Las credenciales y el selector de tenant: historia 008 de esta épica.
- La lista de endpoints de la API, la descarga del material de ejemplo, la tabla de familias responsive y el estado de la API en esta página: pendiente de asignar a una épica.
- Los textos alternos de las pantallas de Programas, Requisitos, No conformidades y Perfil: las épicas de cada módulo.
