---
id: US-CAOS-RESET-014
tipo: historia
epica: EP-CAOS-RESET
titulo: "[Móvil] Restaurar los datos del tenant desde Administración"
etiquetas: [movil]
relacionadas: [US-CAOS-RESET-001, US-CAOS-RESET-009, US-CAOS-RESET-013]
verificacion: ejecutada
cubre: ["/admin"]
---

## Historia
Como administrador de un tenant que prueba desde el móvil, quiero restaurar los datos de mi tenant desde la pestaña «Datos» de Administración, con una confirmación de la propia aplicación,
para dejar el seed sin usar un ordenador ni un diálogo del navegador.

## Reglas
- La pestaña «Datos» muestra el título «Datos del tenant», su texto de ayuda (restaura el seed determinista del tenant y conserva el modo caos), la línea «Tenant: alumno01» y los botones «Información del tenant» y «Restaurar datos del tenant».
- «Restaurar datos del tenant» abre un diálogo de la aplicación con el título «Restaurar datos del tenant», el texto «¿Restaurar los datos del tenant al estado inicial? Se perderán los cambios que hayas hecho.», el botón «Restaurar datos del tenant» y el botón «Cancelar».
- «Cancelar» cierra el diálogo sin enviar nada.
- Confirmar deja el diálogo ocupado mientras la respuesta llega. Al terminar, el diálogo se cierra y aparece el aviso de éxito «Datos restaurados», con el tenant y los milisegundos del reinicio en el cuerpo.
- Si el reinicio falla, el diálogo se cierra y aparece el aviso de error «Ha ocurrido un error inesperado» con la traza de la petición.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se lee el modo caos con `GET /api/admin/chaos`; si no está apagado (`latencyMs` 0, `errorRate` 0 y `flakyLabels` false), se apaga con `PATCH /api/admin/chaos`. Al terminar la fila, se vuelve a reiniciar el tenant y a apagar el caos. La fila empieza sin sesión guardada en la app salvo que diga otra cosa.

## Criterios de aceptación
```gherkin
Característica: Reinicio de los datos del tenant desde la app móvil

  Esquema del escenario: Cancelar el diálogo no reinicia nada
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en la app móvil con el tenant alumno01 y tiene abierta la pestaña «Datos» de Administración
    Cuando pulsa «Restaurar datos del tenant» y después <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | «Cancelar» | el diálogo se cierra y no aparece ningún aviso de éxito |

  Esquema del escenario: Confirmar el diálogo reinicia el tenant y lo confirma con un aviso
    Dado que el tenant alumno01 está recién reiniciado y con el modo caos apagado, y alumno01@sigpro.lab ha iniciado sesión en la app móvil con el tenant alumno01 y tiene abierta la pestaña «Datos» de Administración
    Cuando pulsa «Restaurar datos del tenant» y después confirma con el botón «Restaurar datos del tenant» del diálogo
    Entonces el diálogo se cierra y aparece el aviso de éxito «Datos restaurados» con el tenant <tenant> y los milisegundos del reinicio en el cuerpo

    Ejemplos:
      | tenant |
      | alumno01 |
```

## Fuera de alcance
- La información del tenant («Información del tenant») y sus datos de usuarios: EP-ADMIN-USUARIOS.
- Las pestañas «Usuarios» y «Auditoría» de Administración: EP-ADMIN-USUARIOS y EP-AUDITORIA.
- El reinicio en la web: historia 009 de esta épica.
- El modo caos desde Administración: historia 013 de esta épica.
- El contrato del reinicio en la API: las historias de la API de esta épica.
