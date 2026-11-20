---
id: US-ADMIN-USUARIOS-009
tipo: historia
epica: EP-ADMIN-USUARIOS
titulo: "[Móvil] Entrar en Administración según el rol y elegir sus pestañas"
etiquetas: [movil]
relacionadas: [US-ADMIN-USUARIOS-006, US-ADMIN-USUARIOS-010, US-ADMIN-USUARIOS-011]
verificacion: ejecutada
cubre: ["/admin"]
---

## Historia
Como administrador de un tenant que usa la app móvil, quiero entrar en Administración desde «Más» y elegir la sección que necesito, y quiero que el resto de roles no vea ni la entrada ni la pantalla,
para gestionar a las personas del tenant también desde el móvil.

## Reglas
- «Más» muestra la entrada «Administración» solo al rol admin. Con los roles program_manager, consultant y auditor no aparece.
- La pantalla de Administración (ruta `/admin`) muestra el título «Administración», el texto «Usuarios, auditoría, modo caos y datos del tenant.» y cuatro pestañas en este orden: «Usuarios», «Auditoría», «Modo caos» y «Datos». Al entrar, «Usuarios» está seleccionada.
- Elegir una pestaña muestra su sección, y la ruta recoge la pestaña: `/admin?tab=audit` para «Auditoría», `/admin?tab=chaos` para «Modo caos» y `/admin?tab=data` para «Datos». Elegir «Usuarios» deja la ruta sin parámetro.
- Una ruta cuya pestaña no existe (`/admin?tab=otra`) o está escrita con mayúsculas (`/admin?tab=AUDIT`) muestra la pestaña «Usuarios».
- Quien no es admin y abre `/admin` ve el aviso «Tu rol no permite administrar el tenant», con la explicación «Solo admin puede entrar en Administración.» y el enlace «Volver a Programas», que lleva a `/programs`. No ve ninguna sección de Administración.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Se abre la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se va a `/login`, se escribe `alumno01` en «Tenant de trabajo» y la persona inicia sesión con el correo y la contraseña de la fila.

## Criterios de aceptación
```gherkin
Característica: Entrar en Administración desde la app móvil

  Esquema del escenario: Solo el admin ve la entrada Administración en Más
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la contraseña <contraseña>
    Cuando abre «Más»
    Entonces <visibilidad> la entrada «Administración»

    Ejemplos:
      | correo | contraseña | visibilidad |
      | alumno01@sigpro.lab | Alumno1234! | ve |
      | gestor@sigpro.test | Gestor1234! | no ve |

  Esquema del escenario: Elegir una pestaña muestra su sección y la ruta la recoge
    Dado que el tenant alumno01 está recién reiniciado, alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la contraseña Alumno1234! y está en /admin
    Cuando elige la pestaña <pestana>
    Entonces la pestaña <pestana> está seleccionada, la ruta es <ruta> y la pantalla muestra esa sección

    Ejemplos:
      | pestana | ruta |
      | «Auditoría» | /admin?tab=audit |
      | «Usuarios» | /admin |

  Esquema del escenario: Una pestaña que no existe en la ruta muestra Usuarios
    Dado que el tenant alumno01 está recién reiniciado y alumno01@sigpro.lab ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la contraseña Alumno1234!
    Cuando abre la ruta /admin?tab=<seccion>
    Entonces la pestaña «Usuarios» está seleccionada y la pantalla muestra la sección «Usuarios del tenant»

    Ejemplos:
      | seccion |
      | otra |
      | AUDIT |

  Esquema del escenario: Quien no es admin abre la ruta /admin y ve el aviso sin ninguna sección
    Dado que el tenant alumno01 está recién reiniciado y <correo> ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y la contraseña <contraseña>
    Cuando abre la ruta /admin
    Entonces ve el aviso «Tu rol no permite administrar el tenant» con la explicación «Solo admin puede entrar en Administración.»
    Y no ve pestañas ni ninguna sección de Administración
    Y al pulsar «Volver a Programas» llega a /programs

    Ejemplos:
      | correo | contraseña |
      | gestor@sigpro.test | Gestor1234! |
      | auditor@sigpro.test | Audit1234! |
```

## Fuera de alcance
- El contenido de la sección «Usuarios» en la app móvil: esta misma épica (historias 010 y 011).
- El contenido de «Auditoría»: épica de Auditoría (EP-AUDITORIA).
- El contenido de «Modo caos» y «Datos»: épica de Modo caos y reinicio del tenant (EP-CAOS-RESET).
- El inicio de sesión en la app y sus avisos: épica de Inicio y cierre de sesión (EP-LOGIN).
- La misma entrada y pestañas en la web: esta misma épica (historia 006).
