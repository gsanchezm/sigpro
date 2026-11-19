---
id: US-PROVEEDORES-002
tipo: historia
epica: EP-PROVEEDORES
titulo: "[Web] Ver los proveedores contratados en el Resumen de un programa"
etiquetas: [web]
relacionadas: [US-PROVEEDORES-001, US-PROVEEDORES-003, US-PROVEEDORES-004, US-PROG-DETALLE-002]
verificacion: ejecutada
cubre: ["/programs/:code"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en el Resumen de un programa qué proveedores tiene contratados, con su NIF, el importe de su contrato con ese programa y si está aprobado,
para saber quién trabaja en el programa y con qué importe, sin tener que buscarlo.

## Reglas
- En el Resumen de `/programs/:code`, debajo de los datos del programa, aparece la sección «Proveedores». Junto a su título se lee «Contratados en este programa».
- La sección lista solo los proveedores con un contrato con este programa, ordenados por nombre. Cada proveedor ocupa una fila con las columnas «Proveedor», «NIF», «Importe» y «Estado».
- El importe es el del contrato con este programa, en euros con separador de miles, como `150.000 €`. El estado es «Aprobado» o «No aprobado».
- En la misma línea que el título, un contador indica cuántos hay: «1 proveedor contratado» si hay uno, y «N proveedores contratados», con el número N, en cualquier otro caso, también con cero.
- Si el programa no tiene proveedores contratados, la sección muestra el mensaje «Este programa no tiene proveedores contratados.» y ninguna fila.
- Mientras llega la lista, la sección muestra un indicador de carga, sin filas ni contador.
- Si la petición de la lista falla, la sección muestra el título «No se pudieron cargar los proveedores» y el botón «Reintentar», sin filas ni contador. Los datos del Resumen siguen visibles.
- «Reintentar» vuelve a pedir la lista. Si llega bien, la sección muestra sus filas y desaparece el aviso de error.
- La sección es de solo lectura: no ofrece ningún botón para añadir, editar o eliminar proveedores del programa.
- Todos los roles (`admin`, `program_manager`, `consultant` y `auditor`) ven la misma sección.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con la cuenta de la fila y se llega a Programas. Las cuentas son `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) y `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Cada fila parte de un contexto nuevo.
- Para los errores, la prueba hace que la petición `GET /api/suppliers?program=PRG-001` responda con el código HTTP de la fila. Para el reintento, solo la primera petición responde con error y las siguientes llegan al servidor.

## Criterios de aceptación
```gherkin
Característica: Proveedores contratados en el Resumen de un programa, en la web

  Esquema del escenario: La sección lista los proveedores contratados del programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /programs/<codigo>
    Entonces en «Proveedores» ve el contador <contador>
    Y ve una fila con <proveedor>, NIF <nif>, importe <importe> y estado <estado>

    Ejemplos:
      | codigo | contador | proveedor | nif | importe | estado |
      | PRG-001 | «1 proveedor contratado» | Aeronáutica Levante S.L. | B11111111 | 150.000 € | «Aprobado» |
      | PRG-009 | «1 proveedor contratado» | Cibertáctica Norte | B15555555 | 350.000 € | «No aprobado» |
      | PRG-012 | «1 proveedor contratado» | Logística Marítima Atlas | B16666666 | 400.000 € | «Aprobado» |

  Esquema del escenario: Un programa sin proveedores contratados muestra el mensaje vacío
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web
    Cuando abre /programs/<codigo>
    Entonces en «Proveedores» ve el contador <contador> y el mensaje «Este programa no tiene proveedores contratados.»
    Y no ve ninguna fila de proveedor

    Ejemplos:
      | codigo | contador |
      | PRG-013 | «0 proveedores contratados» |
      | PRG-024 | «0 proveedores contratados» |

  Esquema del escenario: La sección muestra la carga hasta que llega la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba retrasa <espera> la respuesta de GET /api/suppliers?program=PRG-001
    Cuando abre /programs/PRG-001
    Entonces mientras espera, en «Proveedores» ve el indicador de carga y no ve ninguna fila ni el contador
    Y al llegar la respuesta ve la fila de Aeronáutica Levante S.L.

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un fallo de la lista muestra el aviso de error con su botón de reintento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba hace que la primera petición de GET /api/suppliers?program=PRG-001 responda <codigo_http>
    Cuando abre /programs/PRG-001
    Entonces en «Proveedores» ve el título «No se pudieron cargar los proveedores» y el botón «Reintentar»
    Y no ve ninguna fila de proveedor ni el contador, y sigue viendo el campo «Responsable» con Marta Ruiz

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: «Reintentar» vuelve a pedir la lista y la muestra
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y la prueba hace que la primera petición de GET /api/suppliers?program=PRG-001 responda <codigo_http>
    Cuando abre /programs/PRG-001 y, al ver el aviso de error, pulsa «Reintentar»
    Entonces en «Proveedores» ve la fila de Aeronáutica Levante S.L. y ya no ve el aviso «No se pudieron cargar los proveedores»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: Todos los roles ven la sección en modo de solo lectura
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la web
    Cuando abre /programs/PRG-001
    Entonces en «Proveedores» ve la fila de Aeronáutica Levante S.L. con el estado «Aprobado»
    Y no ve ningún botón para añadir, editar o eliminar proveedores del programa

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | alumno01@sigpro.lab |
      | consultor@sigpro.test |
      | auditor@sigpro.test |
```

## Fuera de alcance
- El buscador de proveedores del tenant y la ficha de un proveedor: EP-PROVEEDORES, en su historia de búsqueda y ficha para la web.
- La API de la lista y sus filtros: EP-PROVEEDORES, en su historia de API.
- La versión de esta sección en la app móvil: EP-PROVEEDORES, en su historia móvil.
- La cabecera, los datos y las pestañas de la ficha, y la ruta `/programs/:code`: EP-PROG-DETALLE.
- La pestaña Hitos y su panel: EP-HITOS.
- El inicio de sesión con el que se llega a la ficha: EP-LOGIN.

## Decisiones pendientes
- La línea de detalle técnico (la traza de la petición fallida) que la sección muestra bajo el título «No se pudieron cargar los proveedores». Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
