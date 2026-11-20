---
id: US-PERFIL-001
tipo: historia
epica: EP-PERFIL
titulo: "[Web] Ver la cuenta y lo que permite el rol en el perfil"
etiquetas: [web]
relacionadas: [US-PERFIL-002, US-PERFIL-003, US-SESION-007]
verificacion: ejecutada
cubre: ["/profile"]
permisos: [nc.create, nc.transition, nc.close, milestone.edit, users.manage, audit.view]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero ver en /profile a qué cuenta corresponde mi sesión y qué me permite mi rol,
para saber con quién estoy trabajando en este navegador y qué acciones puedo hacer antes de buscarlas en la aplicación.

## Reglas
- La página «Perfil» tiene el título «Perfil» y tres secciones con su título: «Cuenta», «Qué puedes hacer con tu rol» y «Preferencias». Esta historia solo describe las dos primeras.
- La sección «Cuenta» muestra cuatro datos de la sesión: «Nombre» (el nombre de la persona), «Correo» (el correo de la cuenta), «Rol» (el nombre del rol en español: «Admin», «Gestor de programas», «Consultor» o «Auditor») y «Tenant» (el identificador del tenant de la sesión, por ejemplo `alumno01`).
- Junto a esos datos hay un avatar con las iniciales del nombre, cuyo nombre accesible es el nombre de la persona.
- Ninguno de esos cuatro datos tiene un control para cambiarlo: la sección «Cuenta» solo se lee.
- La sección «Qué puedes hacer con tu rol» muestra seis permisos, en este orden: «Abrir no conformidades», «Mover no conformidades», «Cerrar no conformidades», «Editar hitos», «Administrar usuarios» y «Ver la auditoría».
- Cada permiso aparece con ✓ si el rol lo tiene y con — si no lo tiene. En la web solo se ven el ✓ y el —; un lector de pantalla anuncia «Permitido» en el primer caso y «No permitido» en el segundo.
- Los permisos de cada rol del seed son estos:
  - Admin: los seis permitidos.
  - Gestor de programas: permitidos «Abrir no conformidades», «Mover no conformidades», «Cerrar no conformidades» y «Editar hitos»; no permitidos «Administrar usuarios» y «Ver la auditoría».
  - Consultor: permitidos «Abrir no conformidades» y «Mover no conformidades»; no permitidos los otros cuatro.
  - Auditor: permitidos «Abrir no conformidades» y «Ver la auditoría»; no permitidos los otros cuatro.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada, la cuenta de la fila inicia sesión con su contraseña y se abre `/profile`. La cuenta `admin@sigpro.test` completa además el segundo paso con el código `123456`, en «Verificar», antes de abrir `/profile`.

## Criterios de aceptación
```gherkin
Característica: Perfil de la persona usuaria en la web

  Esquema del escenario: La sección Cuenta muestra los datos de la sesión
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión con <contraseña> en /login?tenant=alumno01 y ha abierto /profile
    Cuando mira la sección «Cuenta»
    Entonces ve el nombre <nombre>
    Y ve el correo <correo>
    Y ve el rol <rol>
    Y ve el tenant alumno01
    Y el avatar tiene como nombre accesible <nombre>
    Y ninguno de esos cuatro datos tiene un control para cambiarlo

    Ejemplos:
      | correo | contraseña | nombre | rol |
      | admin@sigpro.test | Admin1234! | Marta Ruiz | «Admin» |
      | gestor@sigpro.test | Gestor1234! | Javier Ortega | «Gestor de programas» |
      | consultor@sigpro.test | Consul1234! | Lucía Fernández | «Consultor» |
      | auditor@sigpro.test | Audit1234! | Andrés Molina | «Auditor» |
      | alumno01@sigpro.lab | Alumno1234! | Alumno 01 | «Admin» |

  Esquema del escenario: Cada rol ve sus seis permisos como permitidos o no permitidos
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión con <contraseña> en /login?tenant=alumno01 y ha abierto /profile
    Cuando mira la sección «Qué puedes hacer con tu rol»
    Entonces «Abrir no conformidades» muestra <abrir_nc>
    Y «Mover no conformidades» muestra <mover_nc>
    Y «Cerrar no conformidades» muestra <cerrar_nc>
    Y «Editar hitos» muestra <editar_hitos>
    Y «Administrar usuarios» muestra <administrar_usuarios>
    Y «Ver la auditoría» muestra <ver_auditoria>

    Ejemplos:
      | correo | contraseña | abrir_nc | mover_nc | cerrar_nc | editar_hitos | administrar_usuarios | ver_auditoria |
      | admin@sigpro.test | Admin1234! | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» |
      | gestor@sigpro.test | Gestor1234! | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» | ✓ «Permitido» | — «No permitido» | — «No permitido» |
      | consultor@sigpro.test | Consul1234! | ✓ «Permitido» | ✓ «Permitido» | — «No permitido» | — «No permitido» | — «No permitido» | — «No permitido» |
      | auditor@sigpro.test | Audit1234! | ✓ «Permitido» | — «No permitido» | — «No permitido» | — «No permitido» | — «No permitido» | ✓ «Permitido» |
```

## Fuera de alcance
- Cerrar sesión desde esta página: US-LOGIN-008 (web), de EP-LOGIN.
- Las preferencias de idioma, tema, avisos y resumen semanal: esta misma épica, en US-PERFIL-002.
- El paso al acceso cuando no hay sesión: EP-SESION.
- Cambiar los datos de la cuenta o su rol, que solo hace un administrador: EP-ADMIN-USUARIOS.
