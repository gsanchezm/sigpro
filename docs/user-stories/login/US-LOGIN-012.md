---
id: US-LOGIN-012
tipo: historia
epica: EP-LOGIN
titulo: "[Móvil] Iniciar sesión: entrar en Programas o ver por qué no se puede"
etiquetas: [movil]
relacionadas: [US-LOGIN-001, US-LOGIN-002, US-LOGIN-003, US-LOGIN-007, US-LOGIN-011]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero entrar en la app móvil con mi correo y mi contraseña o, si no puedo, ver un aviso claro de por qué y cuántas veces he fallado,
para trabajar desde el móvil con los permisos de mi rol o saber si debo corregir la contraseña, esperar una aprobación o pedir ayuda a un administrador.

## Reglas
- Con credenciales válidas y una cuenta sin segundo factor se entra en /programs en menos de 5 segundos desde que se pulsa «Entrar».
- Con una cuenta con segundo factor, en lugar de entrar se pasa al paso «Verificación en dos pasos», todavía sin sesión.
- Mientras se espera la respuesta, «Entrar» muestra que está ocupado y no se puede volver a pulsar.
- Pulsar la tecla de envío del teclado desde el campo «Contraseña» equivale a pulsar «Entrar».
- El correo se puede escribir con mayúsculas o con espacios al principio y al final.
- Si el servidor rechaza el acceso, se sigue en /login sin sesión, con el correo y la contraseña escritos, y aparece bajo los campos un aviso de error con un mensaje y, debajo, una línea de detalle técnico, con los mismos textos que la web:

  | Caso | Mensaje | La línea de detalle técnico contiene |
  | --- | --- | --- |
  | Credenciales incorrectas | «Correo o contraseña incorrectos» | `POST /api/auth/login → 401` y `attempts=N`, el número de intento fallido consecutivo |
  | Cuenta bloqueada, o el 5.º intento fallido consecutivo | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | `POST /api/auth/login → 423` |
  | Cuenta pendiente de aprobación | «Cuenta pendiente de aprobación. Revisa tu correo.» | `POST /api/auth/login → 403` |
  | Cuenta desactivada | «Tu cuenta está desactivada. Contacta con un administrador.» | `POST /api/auth/login → 403` |

- El mensaje y la línea de detalle técnico son criterios distintos. La línea es una función deliberada del laboratorio: muestra la petición HTTP real para relacionar la pantalla con la API.
- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa, y un acceso correcto antes del 5.º fallo entra y pone el contador a cero. Una cuenta bloqueada no entra ni con la contraseña correcta.
- Un correo sin cuenta se trata igual que una cuenta existente con la contraseña incorrecta, también en el 5.º intento, que muestra el aviso de cuenta bloqueada: ningún aviso revela si hay una cuenta con ese correo.
- Con una contraseña incorrecta, una cuenta pendiente o desactivada muestra el aviso de credenciales incorrectas.
- El aviso de error desaparece al cambiar el correo o la contraseña, como en la web.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». Los fallos previos se provocan después del reinicio, en /login o con `POST /api/auth/login` (cabecera `x-tenant: alumno01`), con ese correo y una contraseña incorrecta. Para desactivar o reactivar `auditor@sigpro.test`, `alumno01@sigpro.lab` usa Administración o `PATCH /api/admin/users/u4` con `active: false` o `active: true`.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución (`nadie-` seguido de una marca de tiempo y `@sigpro.test`), y sus fallos previos se envían en la propia fila. `(cuenta recién solicitada)` es una solicitud hecha en la propia fila con «Solicitar acceso» y `alumno01` en «Tenant de trabajo», con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión en la app móvil

  Esquema del escenario: Una cuenta activa entra en Programas
    Dado que una persona sin sesión iniciada está en /login con alumno01 en «Tenant de trabajo» y el tenant recién reiniciado
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y <envia>
    Entonces <resultado>

    Ejemplos:
      | correo | contraseña | envia | resultado |
      | gestor@sigpro.test | Gestor1234! | pulsa «Entrar» | en menos de 5 segundos llega a /programs |
      | consultor@sigpro.test | Consul1234! | pulsa «Entrar» | en menos de 5 segundos llega a /programs |
      | auditor@sigpro.test | Audit1234! | pulsa la tecla de envío del teclado en la contraseña | en menos de 5 segundos llega a /programs |
      | (GESTOR@sigpro.test con un espacio delante y otro detrás) | Gestor1234! | pulsa «Entrar» | en menos de 5 segundos llega a /programs |
      | admin@sigpro.test | Admin1234! | pulsa «Entrar» | en menos de 5 segundos ve el título «Verificación en dos pasos» y no tiene sesión iniciada |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que una persona sin sesión iniciada en /login, con alumno01 en «Tenant de trabajo», ha escrito gestor@sigpro.test y Gestor1234!
    Y la prueba retrasa <espera> la respuesta de POST /api/auth/login
    Cuando pulsa «Entrar»
    Entonces durante la espera «Entrar» muestra que está ocupado y no se puede volver a pulsar
    Y al llegar la respuesta llega a /programs

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Las credenciales incorrectas muestran el número de intento
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña incorrecta
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el aviso de error con el mensaje «Correo o contraseña incorrectos»
    Y la línea de detalle técnico contiene POST /api/auth/login → 401 y attempts=<intento>

    Ejemplos:
      | correo | fallos_previos | intento |
      | consultor@sigpro.test | 0 | 1 |
      | consultor@sigpro.test | 1 | 2 |
      | consultor@sigpro.test | 3 | 4 |
      | (correo sin cuenta) | 0 | 1 |
      | (correo sin cuenta) | 3 | 4 |
      | pendiente@sigpro.test | 0 | 1 |

  Esquema del escenario: El quinto intento fallido bloquea la cuenta y una cuenta bloqueada no entra
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos <resultado>

    Ejemplos:
      | correo | fallos_previos | contraseña | resultado |
      | consultor@sigpro.test | 3 | incorrecta | ve el mensaje «Correo o contraseña incorrectos» y la línea de detalle técnico contiene POST /api/auth/login → 401 |
      | consultor@sigpro.test | 4 | incorrecta | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |
      | consultor@sigpro.test | 4 | Consul1234! | llega a /programs |
      | consultor@sigpro.test | 5 | Consul1234! | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |
      | (correo sin cuenta) | 4 | incorrecta | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |
      | (correo sin cuenta) | 5 | incorrecta | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |
      | bloqueado@sigpro.test | 0 | Block1234! | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |
      | bloqueado@sigpro.test | 0 | incorrecta | ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» y la línea de detalle técnico contiene POST /api/auth/login → 423 |

  Esquema del escenario: Una cuenta pendiente de aprobación o desactivada no entra y lo dice
    Dado que en el tenant alumno01, recién reiniciado, la cuenta <correo> está <estado>
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje <mensaje>
    Y la línea de detalle técnico contiene <detalle>

    Ejemplos:
      | correo | estado | contraseña | mensaje | detalle |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | «Cuenta pendiente de aprobación. Revisa tu correo.» | POST /api/auth/login → 403 |
      | (cuenta recién solicitada) | pendiente de aprobación | Abcdefghij1! | «Cuenta pendiente de aprobación. Revisa tu correo.» | POST /api/auth/login → 403 |
      | auditor@sigpro.test | desactivada | Audit1234! | «Tu cuenta está desactivada. Contacta con un administrador.» | POST /api/auth/login → 403 |
      | auditor@sigpro.test | desactivada | incorrecta | «Correo o contraseña incorrectos» | POST /api/auth/login → 401 |

  Esquema del escenario: El aviso de error desaparece al corregir los datos
    Dado que en el tenant alumno01, recién reiniciado, una persona en /login con alumno01 en «Tenant de trabajo» ha escrito consultor@sigpro.test con la contraseña incorrecta, ha pulsado «Entrar» y ve el aviso «Correo o contraseña incorrectos»
    Cuando cambia el contenido del campo <campo>
    Entonces deja de ver el aviso de error

    Ejemplos:
      | campo |
      | «Correo electrónico» |
      | «Contraseña» |
```

## Fuera de alcance
- El paso «Verificación en dos pasos»: épica del segundo factor (MFA).
- Qué pestañas y opciones de «Más» ve cada rol: épica de navegación.
- El desbloqueo, la aprobación, la desactivación y la reactivación de cuentas: épica de Usuarios y roles.
