---
id: US-PERFIL-002
tipo: historia
epica: EP-PERFIL
titulo: "[Web] Cambiar las preferencias en borrador y guardarlas en el perfil"
etiquetas: [web]
relacionadas: [US-PERFIL-001, US-PERFIL-004, US-PERFIL-005]
verificacion: ejecutada
cubre: ["/profile"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero cambiar en /profile el idioma, el tema, el aviso de notificaciones en tiempo real y la casilla del resumen semanal, y aplicarlos todos a la vez con «Guardar»,
para decidir cómo veo SIGPRO en este navegador sin que nada cambie mientras elijo.

## Reglas
- La sección «Preferencias» tiene cuatro controles: «Idioma de la interfaz», una lista con «Español» y «English»; «Tema», con dos opciones, «Claro» y «Oscuro», de las que solo una está marcada; «Notificaciones en tiempo real», un interruptor; y «Recibir un resumen semanal por correo (simulado)», una casilla.
- Sin preferencias guardadas, el idioma es «Español», el tema es «Claro», el interruptor de notificaciones está activado y la casilla del resumen semanal está desmarcada.
- Cambiar un control no aplica nada: el cambio solo se ve en la página hasta que se pulsa «Guardar».
- «Guardar» está deshabilitado mientras el borrador es igual a lo guardado. Al pasar el cursor por el botón deshabilitado, su explicación es «No hay cambios que guardar». Si un control vuelve a su valor guardado, «Guardar» vuelve a quedar deshabilitado.
- Al pulsar «Guardar» se aplican todas las preferencias a la vez, aparece el aviso «Preferencias guardadas» y «Guardar» vuelve a quedar deshabilitado. El aviso sale en el idioma que había antes de guardar.
- Un cambio sin guardar se descarta al salir de /profile: al volver, la página muestra lo guardado.
- Lo guardado se conserva al recargar /profile en este navegador.
- El resumen semanal es simulado: guardar la casilla no envía ningún correo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), con la cabecera `x-tenant: alumno01`. Antes de cada fila, el caos del tenant debe estar apagado: `GET /api/config` devuelve `chaos` con latencia 0, tasa de error 0 y etiquetas no variables; si no lo está, `PATCH /api/admin/chaos` lo apaga con el token del administrador del tenant. Después se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión ni ninguna preferencia de SIGPRO guardadas, la cuenta `gestor@sigpro.test` inicia sesión con `Gestor1234!` y se abre `/profile`. Solo la fila de textos alternos deja el caos encendido: antes de abrir `/profile`, la prueba activa los textos alternos con `PATCH /api/admin/chaos` (`flakyLabels` en `true`, con el token del administrador del tenant).

## Criterios de aceptación
```gherkin
Característica: Preferencias del perfil en la web

  Esquema del escenario: Guardar solo se activa cuando hay un cambio pendiente
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01 y ha abierto /profile sin cambios
    Cuando <accion>
    Entonces «Guardar» está <estado>

    Ejemplos:
      | accion | estado |
      | no toca ningún control | deshabilitado, con la explicación «No hay cambios que guardar» al pasar el cursor |
      | cambia «Idioma de la interfaz» a «English» | habilitado |
      | cambia «Idioma de la interfaz» a «English» y después vuelve a «Español» | deshabilitado, con la explicación «No hay cambios que guardar» al pasar el cursor |
      | cambia «Tema» a «Oscuro» | habilitado |
      | desmarca «Notificaciones en tiempo real» | habilitado |
      | marca «Recibir un resumen semanal por correo (simulado)» | habilitado |

  Esquema del escenario: Un cambio sin guardar no se aplica y se descarta al salir
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01 y ha abierto /profile sin cambios
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | cambia «Idioma de la interfaz» a «English» y no pulsa «Guardar» | el título de la página sigue siendo «Perfil» y el selector muestra «English» |
      | cambia «Idioma de la interfaz» a «English», abre /programs sin pulsar «Guardar» y vuelve a /profile | el título de la página es «Perfil» y el selector muestra «Español» |
      | cambia «Tema» a «Oscuro», abre /programs sin pulsar «Guardar» y vuelve a /profile | la opción «Claro» está marcada |

  Esquema del escenario: Guardar aplica las preferencias, avisa y se conservan al recargar
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01 y ha abierto /profile sin cambios
    Cuando <cambio> y pulsa «Guardar»
    Entonces ve el aviso «Preferencias guardadas»
    Y «Guardar» vuelve a estar deshabilitado
    Y al recargar /profile, <tras_recargar>

    Ejemplos:
      | cambio | tras_recargar |
      | cambia «Tema» a «Oscuro» | la opción «Oscuro» está marcada |
      | desmarca «Notificaciones en tiempo real» | el interruptor «Notificaciones en tiempo real» está desactivado |
      | marca «Recibir un resumen semanal por correo (simulado)» | la casilla «Recibir un resumen semanal por correo (simulado)» está marcada |
      | cambia «Tema» a «Oscuro», desmarca «Notificaciones en tiempo real» y marca «Recibir un resumen semanal por correo (simulado)» | la opción «Oscuro» está marcada, el interruptor «Notificaciones en tiempo real» está desactivado y la casilla del resumen semanal está marcada |

  Esquema del escenario: El idioma guardado cambia la página y el aviso sale en el idioma anterior
    Dado que el tenant alumno01 está recién reiniciado y gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01 y ha abierto /profile sin cambios
    Cuando cambia «Idioma de la interfaz» a <idioma> y pulsa «Guardar»
    Entonces ve el aviso «Preferencias guardadas»
    Y el título de la página es <titulo>
    Y el selector muestra <idioma>

    Ejemplos:
      | idioma | titulo |
      | «English» | «Profile» |

  Esquema del escenario: Con los textos alternos del modo caos, «Guardar» alterna su texto y guarda con cualquiera de los dos
    Dado que el tenant alumno01 está recién reiniciado, con los textos alternos del modo caos activados, y gestor@sigpro.test ha iniciado sesión con Gestor1234! en /login?tenant=alumno01, ha abierto /profile y ha cambiado «Tema» a «Oscuro» sin pulsar «Guardar»
    Cuando <accion>
    Entonces <resultado>

    Ejemplos:
      | accion | resultado |
      | observa el botón «Guardar» durante el tiempo que elige la prueba | su texto alterna entre «Guardar» y «Guardar cambios» |
      | pulsa el botón con el texto que tiene en ese momento | ve el aviso «Preferencias guardadas» |
```

## Fuera de alcance
- Cerrar sesión desde esta página y el aviso «Sesión cerrada correctamente.»: US-LOGIN-008, de EP-LOGIN.
- Cómo se aplican el idioma y el tema en el resto de la aplicación, y el selector de idioma de la cabecera: EP-I18N y EP-TEMA.
- Lo que cuenta la campana de avisos cuando el interruptor de notificaciones está desactivado: la épica del Panel de misión.
- La activación de los textos alternos del modo caos y el resto de sus efectos: la épica de Administración.

## Decisiones pendientes
- Si el resumen semanal llegará algún día por correo real. Hoy la casilla solo se guarda y el envío es simulado.
