---
id: US-PROVEEDORES-003
tipo: historia
epica: EP-PROVEEDORES
titulo: "[Web] Buscar un proveedor del tenant desde el Resumen de un programa y ver su ficha"
etiquetas: [web]
relacionadas: [US-PROVEEDORES-001, US-PROVEEDORES-002, US-PROVEEDORES-004, US-PROG-DETALLE-002]
verificacion: codigo
cubre: ["/programs/:code"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero buscar cualquier proveedor de mi tenant desde el Resumen de un programa y abrir su ficha, con su NIF, su correo de contacto, su estado y todos sus contratos,
para comprobar con qué otros programas trabaja un proveedor y en qué importes, sin salir del programa en el que estoy.

## Reglas
- Bajo la lista de proveedores contratados, en la sección «Proveedores», está el campo «Proveedor del tenant». Mientras está vacío, muestra el texto «Buscar proveedor…».
- Al enfocar el campo, o al escribir en él, se abre una lista de opciones con los proveedores del tenant que cumplen el texto. La búsqueda es por nombre o por NIF, sin distinguir mayúsculas. Con el campo vacío, cumplen todos.
- La búsqueda se pide al servidor cuando el texto lleva 250 ms sin cambiar, para no pedir una respuesta por cada letra. Mientras espera la respuesta, el aviso de la búsqueda dice «Buscando proveedores…».
- La lista enseña como mucho cinco opciones, por orden de nombre. El aviso de la búsqueda dice «N proveedores encontrados», con N el total que cumple el texto. Si N es uno, dice «1 proveedor encontrado». Si hay más opciones de las que se enseñan, añade «· M más: afina la búsqueda», con M las que no se enseñan.
- Si ningún proveedor cumple el texto, el aviso dice «Sin coincidencias» y no hay lista de opciones.
- Si la búsqueda falla, el aviso dice «No se pudo buscar proveedores» y no hay lista de opciones.
- Con el campo enfocado y la lista abierta, la primera opción queda activa al abrirse. La flecha abajo pasa a la opción siguiente y la flecha arriba a la anterior. En la primera opción la flecha arriba no sale de la lista, y en la última la flecha abajo tampoco. Intro elige la opción activa.
- Pulsar Esc cierra la lista sin elegir y conserva el texto escrito. Salir del campo también cierra la lista sin elegir.
- Pulsar una opción con el ratón la elige, igual que Intro.
- Al elegir un proveedor, el campo muestra su nombre, la lista se cierra y aparece su ficha debajo del campo, con el título «Ficha de proveedor:» y, a continuación, el nombre del proveedor.
- La ficha muestra el NIF, el «Correo de contacto», el estado («Aprobado» o «No aprobado») y, bajo «Contratos», una línea por cada contrato del proveedor, con todos sus contratos y no solo los del programa en el que está. Cada línea trae el código del programa, que es un enlace a `/programs/<código>`, el nombre del programa, el importe y «Firmado el» seguido de la fecha de firma en formato `dd/mm/aaaa`.
- El botón «Quitar proveedor seleccionado» (un icono con una ×) quita la elección: el campo queda vacío y desaparece la ficha.
- Buscar, elegir o quitar un proveedor no cambia la lista de proveedores contratados del programa.
- Preparación de cada fila: se reinicia `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, se inicia sesión con `gestor@sigpro.test` (`Gestor1234!`) y se llega a Programas. Cada fila parte de un contexto nuevo.
- Para el fallo de la búsqueda, la prueba hace que la petición `GET /api/suppliers?q=fall` responda con el código HTTP de la fila.

## Criterios de aceptación
```gherkin
Característica: Búsqueda de proveedores del tenant y ficha, en la web

  Esquema del escenario: La búsqueda cuenta los proveedores que cumplen el texto y dice cuántos ve
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001
    Cuando <accion>
    Entonces <lista>
    Y el aviso de la búsqueda dice <aviso>

    Ejemplos:
      | accion | lista | aviso |
      | abre «Proveedor del tenant» sin escribir | ve cinco opciones | «6 proveedores encontrados · 1 más: afina la búsqueda» |
      | escribe a en «Proveedor del tenant» | ve cinco opciones | «6 proveedores encontrados · 1 más: afina la búsqueda» |
      | escribe ca en «Proveedor del tenant» | ve cinco opciones | «5 proveedores encontrados» |
      | escribe e en «Proveedor del tenant» | ve cuatro opciones | «4 proveedores encontrados» |
      | escribe Sistemas en «Proveedor del tenant» | ve una opción | «1 proveedor encontrado» |
      | escribe zzzzzz en «Proveedor del tenant» | no ve ninguna lista de opciones | «Sin coincidencias» |

  Esquema del escenario: Sin texto, la lista enseña los cinco primeros proveedores por nombre
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001
    Cuando abre «Proveedor del tenant» sin escribir
    Entonces la opción <lugar> de la lista es <opcion>
    Y no ve «Sistemas Ibéricos S.A.» en la lista

    Ejemplos:
      | lugar | opcion |
      | 1 | Aeronáutica Levante S.L. |
      | 2 | Cibertáctica Norte |
      | 3 | Electrónica del Cantábrico |
      | 4 | Logística Marítima Atlas |
      | 5 | Optrónica Meseta S.L. |

  Esquema del escenario: La búsqueda encuentra por NIF y sin distinguir mayúsculas
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001
    Cuando escribe <texto> en «Proveedor del tenant»
    Entonces la única opción es <opcion>

    Ejemplos:
      | texto | opcion |
      | b1555 | Cibertáctica Norte |
      | IBÉRICOS | Sistemas Ibéricos S.A. |
      | B11111111 | Aeronáutica Levante S.L. |

  Esquema del escenario: Mientras busca, el aviso dice que está buscando y luego muestra el resultado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y la prueba retrasa <espera> la respuesta de GET /api/suppliers?q=Levante
    Cuando escribe Levante en «Proveedor del tenant»
    Entonces mientras espera, el aviso de la búsqueda dice «Buscando proveedores…» y no ve ninguna opción
    Y al llegar la respuesta la única opción es Aeronáutica Levante S.L.

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Un fallo de la búsqueda muestra su aviso y no ofrece opciones
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y la prueba hace que GET /api/suppliers?q=fall responda <codigo_http>
    Cuando escribe fall en «Proveedor del tenant»
    Entonces el aviso de la búsqueda dice «No se pudo buscar proveedores»
    Y no ve ninguna lista de opciones

    Ejemplos:
      | codigo_http |
      | 500 |
      | 503 |

  Esquema del escenario: Elegir un proveedor con el ratón muestra su ficha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001
    Cuando escribe <texto> en «Proveedor del tenant» y pulsa la opción de <proveedor>
    Entonces el campo muestra <proveedor>, la lista de opciones se cierra y aparece la ficha de proveedor de <proveedor>
    Y en la ficha ve el NIF <nif>, el «Correo de contacto» <correo> y el estado <estado>

    Ejemplos:
      | texto | proveedor | nif | correo | estado |
      | Levante | Aeronáutica Levante S.L. | B11111111 | contacto@proveedor1.example | «Aprobado» |
      | norte | Cibertáctica Norte | B15555555 | contacto@proveedor5.example | «No aprobado» |
      | IBÉRICOS | Sistemas Ibéricos S.A. | B12222222 | contacto@proveedor2.example | «Aprobado» |

  Esquema del escenario: Cada contrato de la ficha muestra su programa, su importe y su fecha de firma
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y ha elegido en «Proveedor del tenant» a <proveedor>
    Cuando mira la línea del contrato con <codigo> en la ficha
    Entonces ve <nombre_programa>, el importe <importe> y <firma>

    Ejemplos:
      | proveedor | codigo | nombre_programa | importe | firma |
      | Aeronáutica Levante S.L. | PRG-002 | Radar de vigilancia costera RVC-2 | 150.000 € | «Firmado el 15/01/2025» |
      | Cibertáctica Norte | PRG-009 | Vehículo blindado modular VBM | 350.000 € | «Firmado el 15/05/2025» |

  Esquema del escenario: El código de un contrato lleva a su programa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y ha elegido en «Proveedor del tenant» a Aeronáutica Levante S.L.
    Cuando pulsa el código <codigo> de un contrato de la ficha
    Entonces llega a /programs/<codigo>

    Ejemplos:
      | codigo |
      | PRG-001 |
      | PRG-002 |

  Esquema del escenario: Con el teclado se elige la opción activa
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web y abre /programs/PRG-001
    Cuando enfoca «Proveedor del tenant» y pulsa <teclas>
    Entonces el campo muestra <proveedor> y aparece su ficha de proveedor

    Ejemplos:
      | teclas | proveedor |
      | ↓ y después Intro | Cibertáctica Norte |
      | ↓ ocho veces y después Intro | Optrónica Meseta S.L. |
      | ↑ y después Intro | Aeronáutica Levante S.L. |

  Esquema del escenario: Esc o salir del campo cierra la lista sin elegir
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y ha escrito ca en «Proveedor del tenant»
    Cuando <salida>
    Entonces no ve ninguna lista de opciones
    Y el campo sigue con el texto «ca» y no aparece ninguna ficha de proveedor

    Ejemplos:
      | salida |
      | pulsa Esc |
      | pulsa fuera del campo, sobre el título «Proveedores» de la sección |

  Esquema del escenario: El botón de quitar la elección deja el campo vacío y oculta la ficha
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión en la web, abre /programs/PRG-001 y ha elegido en «Proveedor del tenant» a <proveedor>
    Cuando pulsa «Quitar proveedor seleccionado»
    Entonces el campo «Proveedor del tenant» queda vacío y no aparece ninguna ficha de proveedor

    Ejemplos:
      | proveedor |
      | Aeronáutica Levante S.L. |
      | Cibertáctica Norte |
```

## Fuera de alcance
- La lista de proveedores contratados del programa y sus estados de carga, vacío y error: EP-PROVEEDORES, en su historia de la web de proveedores contratados.
- La API de la búsqueda y sus filtros: EP-PROVEEDORES, en su historia de API.
- La versión de esta búsqueda en la app móvil: EP-PROVEEDORES, en su historia móvil.
- La cabecera, los datos y las pestañas de la ficha del programa, y la ruta `/programs/:code`: EP-PROG-DETALLE.
- La búsqueda global de la cabecera, que es otra búsqueda: EP-NAVEGACION.
- El inicio de sesión con el que se llega a la ficha del programa: EP-LOGIN.

## Decisiones pendientes
- Qué texto queda en el campo al escribir sobre un proveedor ya elegido. Hoy el texto nuevo se mezcla con el nombre que tenía el campo, y la búsqueda se pide con ese texto completo; no está decidido si debe sustituir al nombre. Ningún ejemplo de esta historia escribe sobre una elección.
- Si la búsqueda debe ignorar las tildes. Hoy «ibericos» no encuentra a Sistemas Ibéricos S.A. y «ibéricos» sí. Hasta que se decida, ninguna fila lo afirma.
