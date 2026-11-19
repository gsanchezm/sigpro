---
id: US-PROVEEDORES-004
tipo: historia
epica: EP-PROVEEDORES
titulo: "[Móvil] Ver los proveedores contratados y buscar un proveedor en la pestaña «Proveedores»"
etiquetas: [movil]
relacionadas: [US-PROVEEDORES-001, US-PROVEEDORES-002, US-PROVEEDORES-003, US-PROG-DETALLE-005]
verificacion: ejecutada
cubre: ["/programs/:code"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en la app móvil qué proveedores tiene contratados un programa, y buscar cualquier proveedor de mi tenant para ver su ficha, con su NIF, su correo de contacto, su estado y todos sus contratos,
para saber quién trabaja en un programa y con qué importes, y comprobar con qué otros programas trabaja un proveedor, desde el móvil.

## Reglas
- En la ficha de `/programs/:code`, la opción «Proveedores» muestra el panel de proveedores. Bajo el título «Proveedores» aparece el texto «Proveedores contratados en este programa y búsqueda de cualquier proveedor del tenant.».
- Debajo del texto, un contador indica cuántos proveedores están contratados: «1 proveedor contratado» si hay uno, y «N proveedores contratados», con el número N, en cualquier otro caso, también con cero.
- El panel lista solo los proveedores con un contrato con este programa, ordenados por nombre. Cada proveedor es una tarjeta con su nombre, «NIF» seguido de su NIF, «Importe» seguido del importe de su contrato con este programa, en euros con separador de miles como `150.000 €`, y su estado: «Aprobado» o «No aprobado».
- Si el programa no tiene proveedores contratados, el panel muestra el mensaje «Este programa no tiene proveedores contratados.» y ninguna tarjeta.
- Mientras llega la lista, el panel muestra «Cargando…» con un indicador, sin tarjetas ni contador.
- Si la petición de la lista falla, el panel muestra el título «No se pudieron cargar los proveedores» y el botón «Reintentar», sin tarjetas ni contador. «Reintentar» vuelve a pedir la lista; si llega bien, muestra las tarjetas y desaparece el aviso de error.
- El buscador es el campo «Proveedor del tenant», con el texto «Buscar proveedor…» mientras está vacío. Al tocarlo se abre la lista de opciones con los proveedores del tenant que cumplen el texto, por nombre o por NIF, sin distinguir mayúsculas. Con el campo vacío, cumplen todos. Cada opción muestra el nombre y el NIF.
- La búsqueda se pide al servidor cuando el texto lleva 250 ms sin cambiar, para no pedir una respuesta por cada letra. Mientras espera la respuesta, el aviso de la búsqueda dice «Buscando proveedores…».
- La lista enseña como mucho cinco opciones, por orden de nombre. El aviso de la búsqueda dice «N proveedores encontrados», con N el total que cumple el texto. Si N es uno, dice «1 proveedor encontrado». Si hay más opciones de las que se enseñan, añade «· M más: afina la búsqueda», con M las que no se enseñan.
- Si ningún proveedor cumple el texto, el aviso dice «Sin coincidencias» y no hay lista de opciones.
- Si la búsqueda falla, el aviso dice «No se pudo buscar proveedores» y no hay lista de opciones.
- Al tocar una opción, el campo muestra el nombre del proveedor, la lista se cierra y aparece su ficha debajo del campo, con el título «Ficha de proveedor:» y, a continuación, el nombre del proveedor.
- La ficha muestra el NIF, el «Correo de contacto», el estado («Aprobado» o «No aprobado») y, bajo «Contratos», una línea por cada contrato del proveedor, con todos sus contratos y no solo los del programa en el que está. Cada línea trae el código del programa, que al tocarlo lleva a `/programs/<código>`, el nombre del programa, el importe y «Firmado el» seguido de la fecha de firma en formato `dd/mm/aaaa`.
- El botón «Quitar proveedor seleccionado» quita la elección: el campo queda vacío y desaparece la ficha.
- El panel es de solo lectura: no ofrece ningún botón para añadir, editar o eliminar proveedores del programa. Buscar, elegir o quitar un proveedor no cambia la lista de proveedores contratados.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después la app móvil se deja en `/login` sin ninguna sesión de SIGPRO guardada, con `alumno01` en «Tenant de trabajo». La cuenta de la fila inicia sesión: `gestor@sigpro.test` (`Gestor1234!`), `consultor@sigpro.test` (`Consul1234!`), `auditor@sigpro.test` (`Audit1234!`) o `alumno01@sigpro.lab` (`Alumno1234!`, rol admin, sin segundo factor). Después se abre la ruta de la fila. Cada fila parte de un contexto nuevo.
- Para la carga, la prueba retrasa la respuesta de `GET /api/suppliers?program=PRG-001` el tiempo que indica la fila. Para el error, la prueba hace que la primera petición de esa misma ruta responda con el código HTTP de la fila; para el reintento, las siguientes peticiones llegan al servidor. Para el fallo de la búsqueda, la prueba hace que `GET /api/suppliers?q=fall` responda con el código HTTP de la fila.

## Criterios de aceptación
```gherkin
Característica: Proveedores del programa y buscador de proveedores en la app móvil

  Esquema del escenario: La pestaña lista los proveedores contratados o dice que no hay ninguno
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y ha abierto la ruta /programs/<codigo>
    Cuando elige la opción «Proveedores»
    Entonces ve el contador <contador>
    Y ve <contenido>

    Ejemplos:
      | codigo | contador | contenido |
      | PRG-001 | «1 proveedor contratado» | una tarjeta de Aeronáutica Levante S.L. con NIF B11111111, importe 150.000 € y estado «Aprobado» |
      | PRG-009 | «1 proveedor contratado» | una tarjeta de Cibertáctica Norte con NIF B15555555, importe 350.000 € y estado «No aprobado» |
      | PRG-013 | «0 proveedores contratados» | el mensaje «Este programa no tiene proveedores contratados.» y ninguna tarjeta |

  Esquema del escenario: La pestaña muestra «Cargando…» hasta que llega la lista
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y la prueba retrasa <espera> la respuesta de GET /api/suppliers?program=PRG-001
    Cuando elige la opción «Proveedores»
    Entonces mientras espera ve «Cargando…» y no ve ninguna tarjeta ni el contador
    Y al llegar la respuesta ve la tarjeta de Aeronáutica Levante S.L.

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un fallo de la lista muestra el aviso de error con su botón de reintento
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y la prueba hace que la primera petición de GET /api/suppliers?program=PRG-001 responda <codigo_http>
    Cuando elige la opción «Proveedores»
    Entonces ve el título «No se pudieron cargar los proveedores» y el botón «Reintentar»
    Y no ve ninguna tarjeta ni el contador

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: «Reintentar» vuelve a pedir la lista y la muestra
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y la prueba hace que la primera petición de GET /api/suppliers?program=PRG-001 responda <codigo_http>
    Cuando elige la opción «Proveedores» y, al ver el aviso de error, pulsa «Reintentar»
    Entonces ve la tarjeta de Aeronáutica Levante S.L. y ya no ve el aviso «No se pudieron cargar los proveedores»

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: Todos los roles ven el panel en modo de solo lectura
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo» y ha abierto la ruta /programs/PRG-001
    Cuando elige la opción «Proveedores»
    Entonces ve la tarjeta de Aeronáutica Levante S.L. con estado «Aprobado»
    Y no ve ningún botón para añadir, editar o eliminar proveedores del programa

    Ejemplos:
      | cuenta |
      | gestor@sigpro.test |
      | alumno01@sigpro.lab |
      | consultor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: La búsqueda cuenta los proveedores que cumplen el texto y dice cuántos ve
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y ha elegido la opción «Proveedores»
    Cuando <accion>
    Entonces <lista>
    Y el aviso de la búsqueda dice <aviso>

    Ejemplos:
      | accion | lista | aviso |
      | toca «Proveedor del tenant» sin escribir | ve cinco opciones | «6 proveedores encontrados · 1 más: afina la búsqueda» |
      | escribe a en «Proveedor del tenant» | ve cinco opciones | «6 proveedores encontrados · 1 más: afina la búsqueda» |
      | escribe ca en «Proveedor del tenant» | ve cinco opciones | «5 proveedores encontrados» |
      | escribe e en «Proveedor del tenant» | ve cinco opciones | «5 proveedores encontrados» |
      | escribe Sistemas en «Proveedor del tenant» | ve una opción | «1 proveedor encontrado» |
      | escribe zzzzzz en «Proveedor del tenant» | no ve ninguna lista de opciones | «Sin coincidencias» |

  Esquema del escenario: Sin texto, la lista enseña los cinco primeros proveedores por nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y ha elegido la opción «Proveedores»
    Cuando toca «Proveedor del tenant» sin escribir
    Entonces la opción <lugar> de la lista es <opcion>
    Y no ve «Sistemas Ibéricos S.A.» en la lista

    Ejemplos:
      | lugar | opcion |
      | 1 | Aeronáutica Levante S.L. |
      | 2 | Cibertáctica Norte |
      | 3 | Electrónica del Cantábrico |
      | 4 | Logística Marítima Atlas |
      | 5 | Optrónica Meseta S.L. |

  Esquema del escenario: Un fallo de la búsqueda muestra su aviso y no ofrece opciones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001, ha elegido la opción «Proveedores» y la prueba hace que GET /api/suppliers?q=fall responda <codigo_http>
    Cuando escribe fall en «Proveedor del tenant»
    Entonces el aviso de la búsqueda dice «No se pudo buscar proveedores»
    Y no ve ninguna lista de opciones

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: Tocar un proveedor muestra su ficha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001 y ha elegido la opción «Proveedores»
    Cuando escribe <texto> en «Proveedor del tenant» y toca la opción de <proveedor>
    Entonces el campo muestra <proveedor>, la lista se cierra y ve la ficha de proveedor de <proveedor>
    Y en la ficha ve el NIF <nif>, el «Correo de contacto» <correo> y el estado <estado>

    Ejemplos:
      | texto | proveedor | nif | correo | estado |
      | Levante | Aeronáutica Levante S.L. | B11111111 | contacto@proveedor1.example | «Aprobado» |
      | norte | Cibertáctica Norte | B15555555 | contacto@proveedor5.example | «No aprobado» |
      | IBÉRICOS | Sistemas Ibéricos S.A. | B12222222 | contacto@proveedor2.example | «Aprobado» |

  Esquema del escenario: Cada contrato de la ficha muestra su programa, su importe y su fecha de firma
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001, ha elegido la opción «Proveedores» y ha elegido en «Proveedor del tenant» a <proveedor>
    Cuando mira la línea del contrato con <codigo> en la ficha
    Entonces ve <nombre_programa>, el importe <importe> y <firma>

    Ejemplos:
      | proveedor | codigo | nombre_programa | importe | firma |
      | Aeronáutica Levante S.L. | PRG-002 | Radar de vigilancia costera RVC-2 | 150.000 € | «Firmado el 15/01/2025» |
      | Cibertáctica Norte | PRG-009 | Vehículo blindado modular VBM | 350.000 € | «Firmado el 15/05/2025» |

  Esquema del escenario: El código de un contrato lleva a su programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001, ha elegido la opción «Proveedores» y ha elegido en «Proveedor del tenant» a Aeronáutica Levante S.L.
    Cuando toca el código <codigo> de un contrato de la ficha
    Entonces llega a /programs/<codigo>

    Ejemplos:
      | codigo |
      | PRG-001 |
      | PRG-002 |

  Esquema del escenario: «Quitar proveedor seleccionado» deja el campo vacío y oculta la ficha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la app móvil con alumno01 en «Tenant de trabajo», ha abierto la ruta /programs/PRG-001, ha elegido la opción «Proveedores» y ha elegido en «Proveedor del tenant» a <proveedor>
    Cuando toca «Quitar proveedor seleccionado»
    Entonces el campo «Proveedor del tenant» queda vacío y no ve ninguna ficha de proveedor

    Ejemplos:
      | proveedor |
      | Aeronáutica Levante S.L. |
      | Cibertáctica Norte |
```

## Fuera de alcance
- La lista de proveedores contratados, el buscador y la ficha en la web: EP-PROVEEDORES, en sus historias de la web.
- La API de la lista y sus filtros: EP-PROVEEDORES, en su historia de API.
- La ficha del programa, su cabecera, sus datos, sus otras opciones y la ruta `/programs/:code`: EP-PROG-DETALLE.
- La opción «Hitos» y su panel: EP-HITOS.
- El inicio de sesión con el que se llega a la ficha: EP-LOGIN.
- La búsqueda global de la cabecera: EP-NAVEGACION.

## Decisiones pendientes
- Cómo se cierra la lista de opciones del buscador sin elegir un proveedor. Hoy la lista se cierra solo al elegir una opción; salir del campo no la cierra. No está decidido si debe cerrarse de otra forma. Ninguna fila lo afirma.
- La línea de detalle técnico (la traza de la petición fallida) que el panel muestra bajo el título «No se pudieron cargar los proveedores». Hoy la muestra; no está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
- Qué texto queda en el campo al escribir sobre un proveedor ya elegido. Hoy el texto nuevo se mezcla con el nombre que tenía el campo; no está decidido si debe sustituir al nombre. Ningún ejemplo de esta historia escribe sobre una elección.
- Si la búsqueda debe ignorar las tildes. Hoy «ibericos» no encuentra a Sistemas Ibéricos S.A. y «ibéricos» sí. Hasta que se decida, ninguna fila lo afirma.
