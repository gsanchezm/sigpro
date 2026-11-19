---
id: US-ADMIN-USUARIOS-006
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Web] Entrar en Administración según el rol y elegir sus pestañas"
etiquetas: [web]
relacionadas: [US-ADMIN-USUARIOS-002, US-ADMIN-USUARIOS-007, US-ADMIN-USUARIOS-009, US-LOGIN-007]
verificacion: codigo
cubre: ["/admin"]
---

## Historia
Como administrador de un tenant, quiero entrar en Administración desde el menú y elegir la sección que necesito, y quiero que el resto de roles vea por qué no puede entrar,
para gestionar a las personas del tenant desde la web sin que nadie más lo haga.

## Reglas
- El enlace «Administración» del menú de navegación aparece solo para el rol admin. Con los roles program_manager, consultant y auditor no aparece.
- La página `/admin` muestra, para el admin, el título «Administración» y el texto «Usuarios, auditoría, modo caos y datos del tenant.», y cuatro pestañas en este orden: «Usuarios», «Auditoría», «Modo caos» y «Datos». Al entrar, «Usuarios» está seleccionada.
- Elegir otra pestaña muestra su sección, y la dirección lo recoge: `/admin?tab=audit` para «Auditoría», `/admin?tab=chaos` para «Modo caos» y `/admin?tab=data` para «Datos». Elegir «Usuarios» deja la dirección en `/admin`, sin parámetro.
- Una dirección cuya sección no existe (`/admin?tab=otra`) o está escrita con mayúsculas (`/admin?tab=AUDIT`) muestra la pestaña «Usuarios».
- Quien no es admin y abre `/admin` ve el aviso «Tu rol no permite administrar el tenant», con la explicación «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas», que lleva a `/programs`. No ve pestañas ni ninguna sección de Administración.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y la persona inicia sesión con el correo y la contraseña de la fila.

## Criterios de aceptación
```gherkin
Característica: Entrar en Administración desde la web

  Esquema del escenario: Solo el admin ve el enlace Administración en el menú
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la web con la contraseña <contraseña>
    Cuando mira el menú de navegación
    Entonces <visibilidad> el enlace «Administración»

    Ejemplos:
      | correo | contraseña | visibilidad |
      | alumno01@sigpro.lab | Alumno1234! | ve |
      | gestor@sigpro.test | Gestor1234! | no ve |
      | consultor@sigpro.test | Consul1234! | no ve |
      | auditor@sigpro.test | Audit1234! | no ve |

  Esquema del escenario: Elegir una pestaña muestra su sección y la dirección la recoge
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234! y está en /admin
    Cuando elige la pestaña <pestana>
    Entonces la pestaña <pestana> está seleccionada, la dirección es <direccion> y la página muestra esa sección

    Ejemplos:
      | pestana | direccion |
      | «Auditoría» | /admin?tab=audit |
      | «Modo caos» | /admin?tab=chaos |
      | «Datos» | /admin?tab=data |
      | «Usuarios» | /admin |

  Esquema del escenario: Una sección que no existe en la dirección muestra Usuarios
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la web con la contraseña Alumno1234!
    Cuando abre la dirección /admin?tab=<seccion>
    Entonces la pestaña «Usuarios» está seleccionada y la página muestra la sección «Usuarios del tenant»

    Ejemplos:
      | seccion |
      | otra |
      | AUDIT |

  Esquema del escenario: Quien no es admin abre /admin y ve el aviso sin ninguna sección
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la web con la contraseña <contraseña>
    Cuando abre la dirección /admin
    Entonces ve el aviso «Tu rol no permite administrar el tenant» con la explicación «Solo admin puede entrar en Administración.»
    Y no ve pestañas ni ninguna sección de Administración
    Y al pulsar el enlace «Volver a Programas» llega a /programs

    Ejemplos:
      | correo | contraseña |
      | gestor@sigpro.test | Gestor1234! |
      | consultor@sigpro.test | Consul1234! |
      | auditor@sigpro.test | Audit1234! |
```

## Fuera de alcance
- El contenido de la sección «Usuarios»: esta misma épica (historias 007 y 008).
- El contenido de «Auditoría»: épica de Auditoría (EP-AUDITORIA).
- El contenido de «Modo caos» y «Datos»: épica de Modo caos y reinicio del tenant (EP-CAOS-RESET).
- El inicio de sesión y sus avisos, y la redirección de quien no ha iniciado sesión: épica de Inicio y cierre de sesión (EP-LOGIN).
- La misma entrada y pestañas en la app móvil: esta misma épica (historia 009).
