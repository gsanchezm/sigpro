---
id: US-VER-CASOS-005
tipo: historia
epica: EP-VER-CASOS
titulo: "[Web] Buscar, filtrar, ordenar y paginar la lista de casos con la dirección de la página"
etiquetas: [web]
relacionadas: [US-VER-CASOS-002, US-VER-CASOS-004, US-VER-CASOS-006, US-PROG-LISTA-004]
verificacion: ejecutada
cubre: ["/verification"]
---

## Historia
Como responsable de verificación que busca un caso o quiere ver los que fallan, quiero buscar, filtrar, ordenar y pasar de página en la lista de casos,
para llegar al caso que necesito y, si comparto el enlace, que la lista se vea igual al abrirlo.

## Reglas
- El buscador «Buscar casos de prueba», que muestra el texto de ayuda «Buscar código o título…» mientras está vacío, busca en el código y en el título sin distinguir mayúsculas. La lista se actualiza cuando se deja de escribir; no hay botón de búsqueda.
- «Programa» ofrece «Todos los programas» y los códigos de los programas. «Último resultado» ofrece «Todos los resultados», «Superado», «Fallido», «Bloqueado» y «Sin ejecutar». Los filtros se combinan entre sí y con el texto.
- «Limpiar filtros» aparece cuando hay texto o algún filtro aplicado. Quita el texto y los dos filtros, y deja el orden como estaba.
- Pulsar una cabecera («Código», «Título», «Programa», «Último resultado» o «Ejecuciones») ordena por esa columna en ascendente. Pulsar la columna que ya ordena invierte el sentido. La columna activa se resalta.
- Con una ventana de menos de 1024 px la lista se ve en tarjetas. Siguen el buscador, los filtros, «Limpiar filtros», el recuento, «Página anterior» y «Página siguiente», pero no hay cabeceras que ordenar ni números de página. Por eso el orden por cabecera y los números de página solo se prueban con una ventana de escritorio.
- Cambiar un filtro, escribir en el buscador u ordenar vuelve a la primera página.
- La paginación muestra 10 casos por página con «Página anterior», los números de página y «Página siguiente». En la primera página no se puede pulsar «Página anterior»; en la última, no se puede pulsar «Página siguiente».
- El recuento dice cuántos casos se ven frente al total de la lista filtrada, con la forma «1–10 de 25».
- Los filtros, el orden y la página viven en la dirección de la pantalla: `/verification?q=…&program=…&result=…&sort=…&dir=…&page=…`. Los valores por defecto no aparecen. Sin parámetros, la lista es la de código ascendente, página 1, y abrir una dirección con parámetros muestra la misma lista.
- Un valor no válido en la dirección se ignora. Una página mayor que el número de páginas muestra la última, y la dirección se corrige a esa página.
- Si ningún caso coincide, la pantalla muestra «Sin casos de prueba» y «Ningún caso coincide con los filtros aplicados.», con el botón «Limpiar filtros».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se escribe `gestor@sigpro.test` con `Gestor1234!`, se pulsa «Entrar» y se llega a /programs. Todas las filas se prueban con una ventana de 1024 px o más, salvo que la fila diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Búsqueda, filtros, orden y paginación de casos en la web

  Esquema del escenario: El buscador compara el código y el título sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando escribe <texto> en «Buscar casos de prueba»
    Entonces ve <codigos> y el recuento <recuento>

    Ejemplos:
      | texto | codigos | recuento |
      | cifrado | TC-003, TC-011, TC-019 | «1–3 de 3» |
      | tc-025 | TC-025 | «1–1 de 1» |
      | Autenticación | TC-008, TC-016, TC-024 | «1–3 de 3» |

  Esquema del escenario: El programa y el último resultado filtran la lista y se combinan con el texto
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando elige <programa> en «Programa» y <resultado> en «Último resultado»
    Entonces ve <codigos>, el recuento <recuento> y el resumen <resumen>

    Ejemplos:
      | programa | resultado | codigos | recuento | resumen |
      | PRG-003 | «Todos los resultados» | TC-019, TC-020, TC-021, TC-022, TC-023, TC-024, TC-025 | «1–7 de 7» | «7 casos de prueba · 14 ejecuciones» |
      | «Todos los programas» | «Fallido» | TC-002, TC-006, TC-013, TC-017, TC-021 | «1–5 de 5» | «5 casos de prueba · 10 ejecuciones» |
      | PRG-001 | «Bloqueado» | TC-001, TC-005, TC-009 | «1–3 de 3» | «3 casos de prueba · 6 ejecuciones» |

  Esquema del escenario: Pulsar una cabecera ordena la lista por esa columna
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando pulsa la cabecera <columna> <veces> veces
    Entonces los tres primeros casos son <primeros>

    Ejemplos:
      | columna | veces | primeros |
      | «Código» | 1 | TC-025, TC-024, TC-023 |
      | «Código» | 2 | TC-001, TC-002, TC-003 |
      | «Título» | 1 | TC-008, TC-016, TC-024 |
      | «Último resultado» | 1 | TC-002, TC-006, TC-013 |
      | «Último resultado» | 2 | TC-003, TC-004, TC-007 |
      | «Ejecuciones» | 2 | TC-002, TC-005, TC-008 |

  Esquema del escenario: Un filtro sin coincidencias muestra el aviso de lista vacía con la opción de limpiar filtros
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y está en /verification
    Cuando escribe <texto> en «Buscar casos de prueba» y elige <resultado> en «Último resultado»
    Entonces ve el aviso «Sin casos de prueba» con el texto «Ningún caso coincide con los filtros aplicados.» y el botón «Limpiar filtros»

    Ejemplos:
      | texto | resultado |
      | zzz | «Todos los resultados» |
      | cifrado | «Fallido» |

  Esquema del escenario: «Limpiar filtros» quita el texto y los filtros, y conserva el orden
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, ha escrito <texto> en «Buscar casos de prueba», ha elegido <resultado> en «Último resultado» y ha pulsado la cabecera «Título»
    Cuando pulsa «Limpiar filtros»
    Entonces el campo «Buscar casos de prueba» queda vacío, «Último resultado» vuelve a «Todos los resultados», ve el recuento «1–10 de 25» y los primeros casos son <primeros>

    Ejemplos:
      | texto | resultado | primeros |
      | cifrado | «Superado» | TC-008, TC-016, TC-024 |
      | zzz | «Fallido» | TC-008, TC-016, TC-024 |

  Esquema del escenario: La paginación muestra 10 casos por página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, ha pulsado «Página siguiente» <veces> veces y está en /verification
    Cuando mira la lista
    Entonces ve el recuento <recuento>, el primer caso es <primero> y «Página siguiente» <siguiente>

    Ejemplos:
      | veces | recuento | primero | siguiente |
      | 0 | «1–10 de 25» | TC-001 | se puede pulsar |
      | 1 | «11–20 de 25» | TC-011 | se puede pulsar |
      | 2 | «21–25 de 25» | TC-021 | no se puede pulsar |

  Esquema del escenario: La dirección de la página lleva los filtros, el orden y la página
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre <direccion>
    Entonces ve el recuento <recuento> y el primer caso es <primero>
    Y la dirección queda <direccion_final>

    Ejemplos:
      | direccion | recuento | primero | direccion_final |
      | /verification?result=fail | «1–5 de 5» | TC-002 | /verification?result=fail |
      | /verification?sort=runs&dir=desc&page=2 | «11–20 de 25» | TC-007 | /verification?sort=runs&dir=desc&page=2 |
      | /verification?page=9 | «21–25 de 25» | TC-021 | /verification?page=3 |
      | /verification?result=foo&sort=title&dir=abc | «1–10 de 25» | TC-008 | /verification?result=foo&sort=title&dir=abc |
```

## Fuera de alcance
- La tabla, sus columnas, sus estados de carga, vacío y error, y el resumen sin filtros: la historia de tabla web de EP-VER-CASOS.
- La selección de casos y el informe PDF de la selección o de la lista: EP-VER-INFORME.
- La filtración de la lista por la API y sus valores no válidos: la historia de filtros y orden de la API de EP-VER-CASOS.
- La vuelta desde el detalle: la historia de detalle web de EP-VER-CASOS.

## Decisiones pendientes
- Si la búsqueda ignora las tildes. Hoy «autenticacion» no encuentra «Autenticación», igual que en la API.
