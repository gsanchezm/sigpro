---
id: US-CAOS-RESET-009
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Web] Reiniciar los datos del tenant desde /lab y desde Administración"
etiquetas: [web]
relacionadas: [US-CAOS-RESET-001, US-CAOS-RESET-008, US-CAOS-RESET-014]
verificacion: ejecutada
cubre: ["/admin"]
---

## Historia
Como administrador de mi tenant de prácticas, quiero reiniciar sus datos con un botón y una confirmación, desde /lab o desde la pestaña «Datos» de Administración,
para volver al seed sin usar una línea de comandos.

## Reglas
- En /lab, la sección «Reiniciar datos del tenant» tiene el botón «Reiniciar datos». Al pulsarlo, el navegador muestra su diálogo de confirmación con el texto «¿Reiniciar todos los datos del tenant al estado inicial del seed?».
- En Administración, la pestaña «Datos» tiene el título «Datos del tenant», la línea «Tenant: alumno01» y el botón «Restaurar datos del tenant». Su diálogo de confirmación del navegador dice «¿Restaurar los datos del tenant al estado inicial? Se perderán los cambios que hayas hecho.».
- Cancelar el diálogo no envía nada: los datos no cambian y no aparece ningún aviso de éxito.
- Aceptar el diálogo reinicia el tenant de la sesión. Mientras la respuesta llega, el botón está ocupado (deshabilitado, con el motivo «Procesando…»). Al terminar aparece un aviso de éxito, «Datos reiniciados» en /lab y «Datos restaurados» en Administración, con el tenant y los milisegundos que tardó el reinicio en el cuerpo.
- Si el reinicio falla, aparece el aviso de error «Ha ocurrido un error inesperado» con la traza de la petición.
- Sin sesión de admin, en /lab el botón «Reiniciar datos» está deshabilitado y, al pasar el ratón por él, aparece el motivo «Inicia sesión como admin para reiniciar el tenant.». Ese mismo motivo aparece con cualquier sesión que no sea de admin, por ejemplo la de un gestor de programas.
- Administración solo la ve el admin. Quien no lo es y abre la pestaña «Datos» recibe el aviso «Tu rol no permite administrar el tenant», con el texto «Solo admin puede entrar en Administración.».
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en el navegador salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Reinicio de los datos del tenant desde la web

  Esquema del escenario: Aceptar el diálogo reinicia el tenant y lo confirma con un aviso
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en /login?tenant=alumno01 y está en <pantalla>
    Cuando pulsa <boton> y acepta el diálogo de confirmación del navegador
    Entonces ve el aviso de éxito <aviso> con el tenant alumno01 y los milisegundos del reinicio en el cuerpo

    Ejemplos:
      | pantalla | boton | aviso |
      | /lab | «Reiniciar datos» | «Datos reiniciados» |
      | /admin?tab=data | «Restaurar datos del tenant» | «Datos restaurados» |

  Esquema del escenario: Cancelar el diálogo no reinicia nada
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en /login?tenant=alumno01 y está en <pantalla>
    Cuando pulsa <boton> y cancela el diálogo de confirmación del navegador
    Entonces no aparece ningún aviso de éxito y el botón vuelve a estar disponible

    Ejemplos:
      | pantalla | boton |
      | /lab | «Reiniciar datos» |
      | /admin?tab=data | «Restaurar datos del tenant» |

  Esquema del escenario: Sin sesión de admin el botón de /lab no se puede pulsar
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y <sesion> está en /lab
    Cuando mira el botón «Reiniciar datos»
    Entonces el botón «Reiniciar datos» está deshabilitado y, al pasar el ratón por él, aparece el motivo «Inicia sesión como admin para reiniciar el tenant.»

    Ejemplos:
      | sesion |
      | una persona sin sesión iniciada |
      | gestor@sigpro.test con sesión iniciada |
```

## Fuera de alcance
- Las pestañas «Usuarios» y «Auditoría» de Administración: EP-ADMIN-USUARIOS y EP-AUDITORIA.
- El diálogo «Información del tenant» de la pestaña «Datos»: EP-ADMIN-USUARIOS.
- El contrato del reinicio en la API: las historias de la API de esta épica.
