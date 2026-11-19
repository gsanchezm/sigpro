---
id: US-TOASTS-002
tipo: historia
epica: EP-TOASTS
titulo: "[Transversal] Error del servidor: aviso de error con el título «Ha ocurrido un error inesperado» y rol de alerta"
etiquetas: [transversal]
relacionadas: [US-TOASTS-001, US-TOASTS-004, US-TOASTS-006]
verificacion: codigo
---

## Historia
Como persona que usa SIGPRO, quiero que cuando una acción falla por un error del servidor el aviso me lo diga como un error, con un título claro, y que quien usa un lector de pantalla lo oiga como alerta,
para saber que lo que quise guardar no se ha guardado y que puedo volver a intentarlo.

## Reglas
- Si una acción falla y la pantalla no tiene un mensaje propio para ese caso, el aviso es de tono de error y su título es «Ha ocurrido un error inesperado».
- Un error del servidor no cambia los datos: la acción no se aplica y el dato sigue como estaba antes de pulsar.
- Los avisos de tono de error se anuncian con rol de alerta, que interrumpe la lectura. Los de los demás tonos se anuncian con rol de estado, que no la interrumpe.
- El cuerpo del aviso de error lo pone la pantalla y en esta historia no se compara (ver «Decisiones pendientes»).
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después `gestor@sigpro.test` inicia sesión con `Gestor1234!` en el tenant `alumno01` hasta llegar a /programs, como indica la épica de inicio de sesión (EP-LOGIN). Antes de cada fila el caos del tenant está apagado (`GET /api/config` devuelve latencia 0 y tasa de error 0; si no, se apaga). Si la fila fija una tasa de error, se hace con `PATCH /api/admin/chaos` y el token de `alumno01@sigpro.lab`, con latencia 0 y `errorRate` 1 para el 100 %; el caos solo falla las escrituras de la aplicación, no el inicio de sesión ni la administración. Al terminar la fila se apaga de nuevo con `errorRate` 0.

## Criterios de aceptación
```gherkin
Característica: Aviso de error del servidor

  Esquema del escenario: Archivar muestra el aviso de éxito o el de error según responda el servidor
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test tiene sesión iniciada en /programs y la tasa de error de las escrituras es del <tasa> %
    Cuando abre las acciones de PRG-001 y pulsa «Archivar»
    Entonces ve un aviso de <tono> con el título <titulo>
    Y el aviso se anuncia con el rol de <rol>
    Y PRG-001 queda con el estado <estado_programa>

    Ejemplos:
      | tasa | tono | titulo | rol | estado_programa |
      | 0 | éxito | «PRG-001 archivado» | estado | «Cerrado» |
      | 100 | error | «Ha ocurrido un error inesperado» | alerta | «Activo» |
```

## Fuera de alcance
- La falta de respuesta del servidor en la recuperación de contraseña: EP-RECUPERAR.
- Los errores de carga de una lista, que se muestran como estado de error de su propia pantalla con su reintento.
- Los errores de validación de un formulario, que se muestran junto al campo.

## Decisiones pendientes
- Línea de detalle técnico. Hoy el aviso de error que sale de una respuesta del servidor lleva, bajo el título, una línea con la petición HTTP real (método, ruta y resultado). Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Ningún ejemplo de esta historia la afirma ni la excluye.
- Título cuando no hay respuesta del servidor. Hoy no hay un texto único. En la recuperación de contraseña de la app móvil el título es «No se pudo contactar con el servidor» (EP-RECUPERAR). En el resto de acciones el título sigue siendo «Ha ocurrido un error inesperado» y la línea de detalle técnico describe la petición que no obtuvo respuesta. No está decidido qué título usa cada caso ni si el de falta de conexión debe ser siempre el mismo.
