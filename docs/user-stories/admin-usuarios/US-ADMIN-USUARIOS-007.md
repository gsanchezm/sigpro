---
id: US-ADMIN-USUARIOS-007
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Web] Ver la tabla de usuarios, buscarlos y ver sus avisos de carga, vacío y error"
etiquetas: [web]
relacionadas: [US-ADMIN-USUARIOS-001, US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-006, US-ADMIN-USUARIOS-008, US-ADMIN-USUARIOS-010]
verificacion: ejecutada
---

## Historia
Como administrador de un tenant, quiero una tabla con todas las personas de mi tenant, con su correo, su rol y su estado, y poder buscarlas por nombre o por correo,
para encontrar a quien busco de un vistazo.

## Reglas
- La pestaña «Usuarios» muestra el título «Usuarios del tenant» y una tabla con las columnas «Usuario», «Correo», «Rol», «Activo» y «Estado», en ese orden. Las filas siguen el orden de la lista de la API: la cuenta más antigua primero.
- La columna «Usuario» muestra el avatar y el nombre. La fila de la propia cuenta lleva además la marca «tú», junto al nombre.
- La columna «Rol» muestra un selector con los cuatro roles, con estos nombres: «Admin», «Gestor de programas», «Consultor» y «Auditor».
- La columna «Activo» muestra un interruptor encendido si la cuenta está activa y apagado si está desactivada.
- La columna «Estado» muestra una insignia con uno de estos textos, por prioridad: «Pendiente» si la cuenta está pendiente de aprobación; «Bloqueado» si está bloqueada; «Desactivado» si está desactivada; y «Normal» en los demás casos. Una cuenta pendiente que además está desactivada muestra «Pendiente».
- Encima de la tabla hay un campo «Buscar usuarios», con el texto de ayuda «Nombre o correo…», y el recuento «N de M usuarios». Debajo del recuento aparece la nota «No puedes desactivarte ni cambiar tu propio rol, y siempre debe quedar al menos un admin activo.»
- La búsqueda filtra por nombre o por correo, sin distinguir mayúsculas y sin contar los espacios del principio y del final. El recuento sigue al filtro: M es siempre el total de cuentas del tenant.
- Si ninguna cuenta coincide con la búsqueda, la tabla muestra «Ningún usuario coincide con la búsqueda.».
- Mientras la lista se carga, el recuento muestra «…» y la tabla muestra filas de carga en lugar de cuentas.
- Si la lista no se puede cargar, aparece el aviso «No se pudieron cargar los usuarios», con la traza del error y el botón «Reintentar». Al pulsarlo se pide la lista de nuevo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). La persona inicia sesión en la web con esa cuenta y abre la pestaña «Usuarios» de Administración. Para las esperas y los fallos, la prueba intercepta en el navegador la petición `GET /api/admin/users` que la fila indique.
- En los ejemplos, `(cuenta recién solicitada en alumno01)` es una cuenta creada en la propia fila con `POST /api/auth/register` y la cabecera `x-tenant: alumno01`, con el nombre Ana Prueba, el correo `nueva-` seguido de una marca de tiempo y `@organizacion.es`, la organización Unidad de pruebas, el rol consultant y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Tabla de usuarios de Administración en la web

  Esquema del escenario: La tabla muestra cada cuenta con su rol y su estado
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración
    Cuando mira la fila de <correo>
    Entonces la fila muestra el rol <rol> en el selector de «Rol», el interruptor de «Activo» <activo> y el estado <estado>

    Ejemplos:
      | correo | rol | activo | estado |
      | admin@sigpro.test | Admin | encendido | «Normal» |
      | bloqueado@sigpro.test | Consultor | encendido | «Bloqueado» |
      | pendiente@sigpro.test | Consultor | encendido | «Pendiente» |
      | alumno01@sigpro.lab | Admin | encendido | «Normal» |

  Esquema del escenario: La búsqueda filtra por nombre o correo y cambia el recuento
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y tiene abierta la pestaña «Usuarios» de Administración
    Cuando escribe <busqueda> en «Buscar usuarios»
    Entonces el recuento dice <recuento>
    Y <resultado>

    Ejemplos:
      | busqueda | recuento | resultado |
      | ortega | «1 de 7 usuarios» | solo se ve la fila de gestor@sigpro.test |
      | (GESTOR@SIGPRO.test con un espacio delante y otro detrás) | «1 de 7 usuarios» | solo se ve la fila de gestor@sigpro.test |
      | alumno | «1 de 7 usuarios» | solo se ve la fila de alumno01@sigpro.lab |
      | zzz | «0 de 7 usuarios» | se ve el aviso «Ningún usuario coincide con la búsqueda.» |

  Esquema del escenario: Si la lista no se puede cargar, el aviso ofrece reintentar y al reintentar aparecen las cuentas
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y la prueba responde <codigo> a la primera petición de GET /api/admin/users en el navegador
    Cuando abre la pestaña «Usuarios» de Administración
    Entonces ve el aviso «No se pudieron cargar los usuarios» con la traza del error y el botón «Reintentar»
    Cuando pulsa «Reintentar»
    Entonces la tabla muestra las siete cuentas del tenant

    Ejemplos:
      | codigo |
      | 500 |
      | 503 |

  Esquema del escenario: Mientras la lista carga, el recuento muestra puntos suspensivos
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y la prueba retrasa <espera> la respuesta de GET /api/admin/users en el navegador
    Cuando abre la pestaña «Usuarios» de Administración
    Entonces durante la espera el recuento muestra «…» y la tabla muestra filas de carga
    Y al llegar la respuesta la tabla muestra las siete cuentas del tenant

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Fuera de alcance
- El cambio de rol y de estado desde la tabla y sus avisos: esta misma épica (historia 008).
- El acceso a la pestaña y las pestañas: esta misma épica (historia 006).
- La lista que devuelve la API y su orden: esta misma épica (historia 001).
- La versión de la app móvil: esta misma épica (historia 010).
