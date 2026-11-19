---
id: US-VER-CASOS-008
tipo: historia
epica: EP-VER-CASOS
titulo: "[Móvil] Buscar, filtrar y ordenar la lista de casos"
etiquetas: [movil]
relacionadas: [US-LOGIN-012, US-VER-CASOS-002, US-VER-CASOS-005, US-VER-CASOS-007]
verificacion: codigo
cubre: ["/verification"]
---

## Historia
Como persona que revisa casos desde el teléfono, quiero buscar un caso, elegir su programa y su último resultado, y ordenar la lista con un toque,
para llegar al caso o al grupo de casos que busco sin desplazarme por todos.

## Reglas
- El campo «Buscar casos de prueba», con el texto de ayuda «Buscar código o título…» mientras está vacío, busca en el código y en el título sin distinguir mayúsculas. La lista se actualiza cuando se deja de escribir; no hay botón de búsqueda.
- «Programa» ofrece «Todos los programas» y los códigos de los programas. «Último resultado» ofrece «Todos los resultados», «Superado», «Fallido», «Bloqueado» y «Sin ejecutar». Los filtros se combinan entre sí y con el texto.
- El orden se elige en el grupo «Ordenar por», con los botones «Código», «Título», «Programa», «Último resultado» y «Ejecuciones». Solo uno está elegido a la vez; el elegido muestra una flecha: ↑ si es ascendente y ↓ si es descendente, como en «Código ↓».
- Tocar un orden que no está elegido lo elige en ascendente. Tocar el que ya está elegido invierte el sentido.
- Cada cambio de filtro, de texto o de orden vuelve a la primera carga de 10 casos.
- «Limpiar filtros» aparece cuando hay texto, programa o resultado aplicados. Quita el texto y los dos filtros, y deja el orden elegido.
- El texto, los filtros y el orden viven en la dirección de la pantalla con los mismos nombres que en la web: `/verification?q=…&program=…&result=…&sort=…&dir=…`. Lo que vale lo mismo que el valor por defecto no aparece, y abrir una dirección con esos parámetros muestra la misma lista.
- Un valor no válido en la dirección se ignora.
- Si ningún caso coincide, la pantalla muestra «Sin casos de prueba» y «Ningún caso coincide con los filtros aplicados.», con el botón «Limpiar filtros».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La app está en /login sin ninguna sesión de SIGPRO guardada en el dispositivo, con `alumno01` en «Tenant de trabajo»; `gestor@sigpro.test` (`Gestor1234!`) inicia sesión y llega a /programs, y después abre la sección «Verificación», que lleva a /verification.

## Criterios de aceptación
```gherkin
Característica: Búsqueda, filtros y orden de casos en la app móvil

  Esquema del escenario: El buscador compara el código y el título sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto /verification
    Cuando escribe <texto> en «Buscar casos de prueba»
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | texto | codigos | recuento |
      | cifrado | TC-003, TC-011, TC-019 | «1–3 de 3» |
      | tc-025 | TC-025 | «1–1 de 1» |
      | Autenticación | TC-008, TC-016, TC-024 | «1–3 de 3» |

  Esquema del escenario: El programa y el último resultado filtran la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto /verification
    Cuando elige <programa> en «Programa» y <resultado> en «Último resultado»
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | programa | resultado | codigos | recuento |
      | «Todos los programas» | «Fallido» | TC-002, TC-006, TC-013, TC-017, TC-021 | «1–5 de 5» |
      | PRG-001 | «Bloqueado» | TC-001, TC-005, TC-009 | «1–3 de 3» |
      | PRG-003 | «Todos los resultados» | TC-019, TC-020, TC-021, TC-022, TC-023, TC-024, TC-025 | «1–7 de 7» |

  Esquema del escenario: Tocar un orden lo elige o invierte su sentido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto /verification
    Cuando toca <orden> <veces> veces
    Entonces el orden elegido muestra <chip>, y los tres primeros casos son <primeros>

    Ejemplos:
      | orden | veces | chip | primeros |
      | «Código» | 1 | «Código ↓» | TC-025, TC-024, TC-023 |
      | «Título» | 1 | «Título ↑» | TC-008, TC-016, TC-024 |
      | «Último resultado» | 1 | «Último resultado ↑» | TC-002, TC-006, TC-013 |
      | «Último resultado» | 2 | «Último resultado ↓» | TC-003, TC-004, TC-007 |
      | «Ejecuciones» | 1 | «Ejecuciones ↑» | TC-003, TC-006, TC-009 |
      | «Ejecuciones» | 2 | «Ejecuciones ↓» | TC-002, TC-005, TC-008 |

  Esquema del escenario: «Limpiar filtros» quita el texto y los filtros, y conserva el orden elegido
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil, ha escrito <texto> en «Buscar casos de prueba», ha elegido <resultado> en «Último resultado» y ha tocado «Título»
    Cuando toca «Limpiar filtros»
    Entonces el campo «Buscar casos de prueba» queda vacío, «Último resultado» vuelve a «Todos los resultados», ve el recuento «1–10 de 25» y los primeros casos son <primeros>

    Ejemplos:
      | texto | resultado | primeros |
      | cifrado | «Superado» | TC-008, TC-016, TC-024 |
      | zzz | «Fallido» | TC-008, TC-016, TC-024 |

  Esquema del escenario: Un filtro sin coincidencias muestra el aviso de lista vacía con la opción de limpiar filtros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil y ha abierto /verification
    Cuando escribe <texto> en «Buscar casos de prueba» y elige <resultado> en «Último resultado»
    Entonces ve el aviso «Sin casos de prueba» con el texto «Ningún caso coincide con los filtros aplicados.» y el botón «Limpiar filtros»

    Ejemplos:
      | texto | resultado |
      | zzz | «Todos los resultados» |
      | cifrado | «Fallido» |

  Esquema del escenario: La dirección de la pantalla lleva el texto, los filtros y el orden
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha entrado en la app móvil
    Cuando abre <direccion>
    Entonces ve el recuento <recuento> y el primer caso es <primero>

    Ejemplos:
      | direccion | recuento | primero |
      | /verification?result=fail | «1–5 de 5» | TC-002 |
      | /verification?q=cifrado&sort=title&dir=desc | «1–3 de 3» | TC-019 |
      | /verification?result=foo&dir=abc | «1–10 de 25» | TC-001 |
```

## Fuera de alcance
- La tarjeta, sus datos, el indicador de carga, «Cargar más» y los avisos de carga y de error: la historia de la lista en tarjetas de EP-VER-CASOS.
- La selección de casos, su barra de acciones y el informe PDF: EP-VER-INFORME.
- La filtración de la lista por la API y sus valores no válidos: la historia de filtros y orden de la API de EP-VER-CASOS.
