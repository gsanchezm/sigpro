---
id: US-REQ-FLUJO-008
tipo: historia
epica: EP-REQ-FLUJO
titulo: "[Web] Mostrar el error del servidor dentro del diálogo sin cambiar el estado"
etiquetas: [web]
relacionadas: [US-REQ-FLUJO-006, US-REQ-FLUJO-007, US-REQ-FLUJO-002]
verificacion: codigo
cubre: ["/programs/:code/requirements"]
---

## Historia
Como persona que confirma un cambio de estado en la web, quiero que, si el servidor no lo acepta, el diálogo me lo diga y siga abierto,
para entender que el requisito no ha cambiado y decidir qué hacer con él.

## Reglas
- Si el servidor rechaza el paso, el diálogo sigue abierto y muestra dentro de él un aviso de error. No aparece el aviso «Estado actualizado» y el requisito conserva el estado que tiene en el servidor.
- En la pantalla no se puede pedir un paso que el rol no tiene, porque su botón está deshabilitado. Este caso aparece cuando el detalle muestra un estado que el servidor ya no tiene, porque otra cuenta cambió el requisito después de abrirlo. Los rechazos de la API por paso inexistente y por permiso están descritos en esta misma épica, en sus historias de la API.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la persona abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada y se identifica con `gestor@sigpro.test` (`Gestor1234!`) o `consultor@sigpro.test` (`Consul1234!`). Con esa cuenta abre el detalle del requisito en `/programs/<programa>/requirements`. Después, `alumno01@sigpro.lab` cambia el requisito con la API, en un paso válido. Tras el reinicio, `REQ-017` está en Borrador (en `PRG-002`) y `REQ-001` en Aprobado (en `PRG-001`).

## Criterios de aceptación
```gherkin
Característica: Error del servidor al confirmar el cambio de estado en la web

  Esquema del escenario: Un paso que el servidor rechaza deja el diálogo abierto y el estado sin cambiar
    Dado que el tenant alumno01 está recién reiniciado y <cuenta> ha iniciado sesión en /login?tenant=alumno01 y tiene abierto el detalle de <requisito> en /programs/<programa>/requirements, que muestra el estado <estado_mostrado>
    Y después alumno01@sigpro.lab cambia <requisito> a <estado_servidor> con la API
    Cuando pulsa <boton> y después «Confirmar» en el diálogo
    Entonces aparece dentro del diálogo un aviso de error y el diálogo sigue abierto
    Y no aparece el aviso «Estado actualizado»
    Y una lectura de <requisito> con la API devuelve el estado <estado_servidor>

    Ejemplos:
      | cuenta | requisito | programa | estado_mostrado | estado_servidor | boton |
      | gestor@sigpro.test | REQ-017 | PRG-002 | Borrador | Aprobado | «Aprobar» |
      | consultor@sigpro.test | REQ-001 | PRG-001 | Aprobado | Borrador | «Marcar como verificado» |
```

## Fuera de alcance
- Los rechazos de la API por paso inexistente (409) y por permiso (403), con su orden: en esta misma épica, en sus historias de la API.
- Los botones y su explicación cuando están deshabilitados: en esta misma épica, en la historia de los botones de la web.
- La confirmación y el aviso de éxito: en esta misma épica, en la historia de la confirmación de la web.

## Decisiones pendientes
- La línea de detalle técnico que muestra el diálogo bajo el aviso de error: hoy incluye la petición HTTP real (método, ruta, código de estado y traza), como las pantallas de Acceso. No está decidido si forma parte del producto ni qué debe contener. Ningún ejemplo depende de su texto: el veredicto depende de que el diálogo siga abierto, de que no aparezca el aviso «Estado actualizado» y de que el estado no cambie.
