---
id: US-PERFIL-004
tipo: historia
epica: EP-PERFIL
titulo: "[Móvil] Cambiar las preferencias en borrador y guardarlas en el perfil"
etiquetas: [movil]
relacionadas: [US-PERFIL-002, US-PERFIL-003, US-PERFIL-005, US-LOGIN-013]
verificacion: codigo
cubre: ["/profile"]
---

## Historia
Como persona con una cuenta en SIGPRO que usa la app móvil, quiero cambiar en «Perfil» el idioma, el tema, el aviso de notificaciones en tiempo real y la casilla del resumen semanal, y aplicarlos todos a la vez con «Guardar»,
para decidir cómo uso la app en este dispositivo sin que nada cambie mientras elijo.

## Reglas
- La sección «Preferencias» tiene cuatro controles: «Idioma de la interfaz», con «Español» y «English»; «Tema», con «Claro» y «Oscuro»; «Notificaciones en tiempo real», un interruptor; y «Recibir un resumen semanal por correo (simulado)», una casilla.
- Sin preferencias guardadas en el dispositivo, el idioma es «Español», el tema es «Claro», el interruptor de notificaciones está activado y la casilla del resumen semanal está desmarcada.
- Cambiar un control no aplica nada: el cambio solo se ve en la pantalla hasta que se pulsa «Guardar».
- Mientras el borrador es igual a lo guardado, «Guardar» está deshabilitado y debajo del botón se lee «No hay cambios que guardar». Si un control vuelve a su valor guardado, vuelve a pasar lo mismo.
- Al pulsar «Guardar» se aplican todas las preferencias a la vez, aparece el aviso «Preferencias guardadas» en el idioma que había antes de guardar, y «Guardar» vuelve a quedar deshabilitado.
- Lo guardado se conserva al cerrar la app y volver a abrirla.
- Un cambio sin guardar se descarta al salir de «Perfil»: al volver a abrirlo desde «Más», la pantalla muestra lo guardado.
- El resumen semanal es simulado: guardar la casilla no envía ningún correo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después la app se abre sin ninguna sesión de SIGPRO guardada y sin preferencias guardadas en el dispositivo, con `alumno01` en «Tenant de trabajo» y con el tema claro en el sistema del dispositivo, de modo que el tema inicial es «Claro». La cuenta `gestor@sigpro.test` inicia sesión con `Gestor1234!`, y después se abre «Perfil» desde «Más».

## Criterios de aceptación
```gherkin
Característica: Preferencias del perfil en la app móvil

  Esquema del escenario: «Guardar» solo se activa cuando hay un cambio pendiente
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en la app, con alumno01 en «Tenant de trabajo», y ha abierto «Perfil» desde «Más» sin cambios
    Cuando <accion>
    Entonces «Guardar» está <estado>

    Ejemplos:
      | accion | estado |
      | no toca ningún control | deshabilitado, y se lee «No hay cambios que guardar» |
      | cambia «Idioma de la interfaz» a «English» | habilitado, y no se lee «No hay cambios que guardar» |
      | cambia «Idioma de la interfaz» a «English» y después vuelve a «Español» | deshabilitado, y se lee «No hay cambios que guardar» |
      | cambia «Tema» a «Oscuro» | habilitado, y no se lee «No hay cambios que guardar» |
      | desmarca «Notificaciones en tiempo real» | habilitado, y no se lee «No hay cambios que guardar» |
      | marca «Recibir un resumen semanal por correo (simulado)» | habilitado, y no se lee «No hay cambios que guardar» |

  Esquema del escenario: Un cambio sin guardar no se aplica y se descarta al salir
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en la app, con alumno01 en «Tenant de trabajo», y ha abierto «Perfil» desde «Más» sin cambios
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | cambia «Idioma de la interfaz» a «English» y no pulsa «Guardar» | el título de la pantalla sigue siendo «Perfil» y el selector muestra «English» |
      | cambia «Idioma de la interfaz» a «English», sale de «Perfil» sin pulsar «Guardar» y vuelve a abrirlo desde «Más» | el título de la pantalla es «Perfil» y el selector muestra «Español» |
      | cambia «Tema» a «Oscuro», sale de «Perfil» sin pulsar «Guardar» y vuelve a abrirlo desde «Más» | la opción «Claro» está seleccionada |

  Esquema del escenario: «Guardar» aplica las preferencias, avisa y se conservan al volver a abrir la app
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en la app, con alumno01 en «Tenant de trabajo», y ha abierto «Perfil» desde «Más» sin cambios
    Cuando <cambio> y pulsa «Guardar»
    Entonces ve el aviso «Preferencias guardadas»
    Y «Guardar» vuelve a estar deshabilitado, y se lee «No hay cambios que guardar»
    Y al cerrar la app y volverla a abrir, y abrir «Perfil» desde «Más», <tras_reabrir>

    Ejemplos:
      | cambio | tras_reabrir |
      | cambia «Tema» a «Oscuro» | la opción «Oscuro» está seleccionada |
      | desmarca «Notificaciones en tiempo real» | el interruptor «Notificaciones en tiempo real» está desactivado |
      | marca «Recibir un resumen semanal por correo (simulado)» | la casilla «Recibir un resumen semanal por correo (simulado)» está marcada |
      | cambia «Tema» a «Oscuro», desmarca «Notificaciones en tiempo real» y marca «Recibir un resumen semanal por correo (simulado)» | la opción «Oscuro» está seleccionada, el interruptor «Notificaciones en tiempo real» está desactivado y la casilla del resumen semanal está marcada |

  Esquema del escenario: El idioma guardado cambia la pantalla y el aviso sale en el idioma anterior
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en la app, con alumno01 en «Tenant de trabajo», y ha abierto «Perfil» desde «Más» sin cambios
    Cuando cambia «Idioma de la interfaz» a <idioma> y pulsa «Guardar»
    Entonces ve el aviso «Preferencias guardadas»
    Y el título de la pantalla es <titulo>
    Y el selector muestra <idioma>

    Ejemplos:
      | idioma | titulo |
      | «English» | «Profile» |
```

## Fuera de alcance
- Cerrar sesión desde «Perfil»: US-LOGIN-013, de EP-LOGIN. El aviso «Sesión cerrada correctamente.» de la app: US-LOGIN-014, de EP-LOGIN.
- Los textos alternos del botón «Guardar» del perfil: US-PERFIL-005, de esta misma épica.
- Cómo se aplican el idioma y el tema en el resto de la aplicación: EP-I18N y EP-TEMA.
- Lo que cuenta la campana de avisos en la web cuando el interruptor está desactivado: la épica del Panel de misión.

## Decisiones pendientes
- Qué debe hacer el interruptor «Notificaciones en tiempo real» en la app móvil, que no tiene campana. Hoy solo se guarda y se muestra.
- Si el resumen semanal llegará algún día por correo real. Hoy la casilla solo se guarda y el envío es simulado.
