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
Como persona con una cuenta en SIGPRO, quiero entrar en la app móvil con mi correo y mi contraseña o, si no puedo, ver un aviso claro de por qué,
para trabajar desde el móvil con los permisos de mi rol o saber si debo corregir la contraseña, esperar una aprobación o pedir ayuda a un administrador.

## Reglas
- Con credenciales válidas y una cuenta sin segundo factor se entra en /programs.
- Con una cuenta con segundo factor, en lugar de entrar se pasa al paso «Verificación en dos pasos», todavía sin sesión.
- Mientras se espera la respuesta, «Entrar» muestra que está ocupado y no se puede volver a pulsar.
- Pulsar la tecla de envío del teclado desde el campo «Contraseña» equivale a pulsar «Entrar».
- El correo se puede escribir con mayúsculas o con espacios al principio y al final.
- Si el servidor rechaza el acceso, se sigue en /login sin sesión, con el correo y la contraseña escritos, y aparece bajo los campos un aviso de error con el mensaje que corresponde al caso, con los mismos textos que la web:

  | Caso | Mensaje |
  | --- | --- |
  | Credenciales incorrectas | «Correo o contraseña incorrectos» |
  | Cuenta bloqueada, o el 5.º intento fallido consecutivo | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» |
  | Cuenta pendiente de aprobación | «Cuenta pendiente de aprobación. Revisa tu correo.» |
  | Cuenta desactivada | «Tu cuenta está desactivada. Contacta con un administrador.» |

- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa, y un acceso correcto antes del 5.º fallo entra y pone el contador a cero. Una cuenta bloqueada no entra ni con la contraseña correcta.
- Un correo sin cuenta se trata igual que una cuenta existente con la contraseña incorrecta, también en el 5.º intento, que muestra el aviso de cuenta bloqueada: ningún aviso revela si hay una cuenta con ese correo.
- Con una contraseña incorrecta, una cuenta pendiente o desactivada muestra el aviso de credenciales incorrectas.
- El aviso de error desaparece al cambiar el correo o la contraseña, como en la web.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y la app está en /login sin ninguna sesión de SIGPRO guardada y con `alumno01` en «Tenant de trabajo». Los fallos previos se provocan después del reinicio, en /login o con `POST /api/auth/login` (cabecera `x-tenant: alumno01`), con ese correo y una contraseña incorrecta. Para desactivar o reactivar `auditor@sigpro.test`, `alumno01@sigpro.lab` usa «Administración» o `PATCH /api/admin/users/u4` con `active: false` o `active: true`.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución (`nadie-` seguido de una marca de tiempo y `@sigpro.test`), y sus fallos previos se envían en la propia fila. `(cuenta recién solicitada)` es una solicitud hecha en la propia fila con «Solicitar acceso» y `alumno01` en «Tenant de trabajo», con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión en la app móvil

  Esquema del escenario: Una cuenta activa entra en «Programas»
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login con alumno01 en «Tenant de trabajo»
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y <envia>
    Entonces <resultado>

    Ejemplos:
      | correo | contraseña | envia | resultado |
      | gestor@sigpro.test | Gestor1234! | pulsa «Entrar» | llega a /programs |
      | consultor@sigpro.test | Consul1234! | pulsa «Entrar» | llega a /programs |
      | auditor@sigpro.test | Audit1234! | pulsa la tecla de envío del teclado en la contraseña | llega a /programs |
      | (GESTOR@sigpro.test con un espacio delante y otro detrás) | Gestor1234! | pulsa «Entrar» | llega a /programs |
      | admin@sigpro.test | Admin1234! | pulsa «Entrar» | ve el título «Verificación en dos pasos» y no tiene sesión iniciada |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login, con alumno01 en «Tenant de trabajo», ha escrito gestor@sigpro.test y Gestor1234!
    Y la prueba retrasa <espera> la respuesta de POST /api/auth/login
    Cuando pulsa «Entrar»
    Entonces durante la espera «Entrar» muestra que está ocupado y no se puede volver a pulsar
    Y al llegar la respuesta está en /programs

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Con menos de 5 fallos las credenciales incorrectas muestran el aviso de error y no inician sesión
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña incorrecta
    Y pulsa «Entrar»
    Entonces ve el aviso de error con el mensaje «Correo o contraseña incorrectos»
    Y sigue en /login sin sesión

    Ejemplos:
      | correo | fallos_previos |
      | consultor@sigpro.test | 0 |
      | consultor@sigpro.test | 1 |
      | consultor@sigpro.test | 3 |
      | (correo sin cuenta) | 0 |
      | (correo sin cuenta) | 3 |
      | pendiente@sigpro.test | 0 |

  Esquema del escenario: El quinto intento fallido consecutivo bloquea la cuenta
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el mensaje <mensaje>
    Y sigue en /login sin sesión

    Ejemplos:
      | correo | fallos_previos | contraseña | mensaje |
      | consultor@sigpro.test | 3 | incorrecta | «Correo o contraseña incorrectos» |
      | consultor@sigpro.test | 4 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» |
      | consultor@sigpro.test | 5 | Consul1234! | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» |
      | (correo sin cuenta) | 4 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» |
      | (correo sin cuenta) | 5 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» |

  Esquema del escenario: Con menos de 5 fallos la cuenta sigue activa y la contraseña correcta entra
    Dado que en el tenant alumno01, recién reiniciado, consultor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña Consul1234!
    Y pulsa «Entrar»
    Entonces llega a /programs

    Ejemplos:
      | fallos_previos |
      | 3 |
      | 4 |

  Esquema del escenario: Una cuenta bloqueada no entra ni con su contraseña
    Dado que en el tenant alumno01, recién reiniciado, la cuenta bloqueado@sigpro.test está bloqueada
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.»
    Y sigue en /login sin sesión

    Ejemplos:
      | contraseña |
      | Block1234! |
      | incorrecta |

  Esquema del escenario: Una cuenta pendiente de aprobación o desactivada no entra y lo dice
    Dado que en el tenant alumno01, recién reiniciado, la cuenta <correo> está <estado>
    Cuando en /login, con alumno01 en «Tenant de trabajo», escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces ve el mensaje <mensaje>

    Ejemplos:
      | correo | estado | contraseña | mensaje |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | «Cuenta pendiente de aprobación. Revisa tu correo.» |
      | (cuenta recién solicitada) | pendiente de aprobación | Abcdefghij1! | «Cuenta pendiente de aprobación. Revisa tu correo.» |
      | auditor@sigpro.test | desactivada | Audit1234! | «Tu cuenta está desactivada. Contacta con un administrador.» |
      | auditor@sigpro.test | desactivada | incorrecta | «Correo o contraseña incorrectos» |

  Esquema del escenario: El aviso de error desaparece al corregir los datos
    Dado que en el tenant alumno01, recién reiniciado, una persona en /login con alumno01 en «Tenant de trabajo» ha escrito consultor@sigpro.test con la contraseña incorrecta, ha pulsado «Entrar» y ve el aviso «Correo o contraseña incorrectos»
    Cuando cambia el contenido del campo <campo>
    Entonces deja de ver el aviso de error

    Ejemplos:
      | campo |
      | «Correo electrónico» |
      | «Contraseña» |
```

## Decisiones pendientes
- **Línea de detalle técnico visible.** Hoy los avisos de Acceso muestran, bajo el mensaje, una línea con la petición HTTP real (método, ruta y código de estado; en el inicio de sesión incorrecto, también el número de intento). Está pendiente de decisión de producto si esa línea forma parte del producto, qué debe contener y si el número de intento debe verse también en el propio mensaje. Hasta que se decida, ningún ejemplo de esta historia la afirma ni la excluye, y las pruebas no deben depender de ella.

## Fuera de alcance
- El paso «Verificación en dos pasos»: épica del segundo factor (MFA).
- Qué pestañas y opciones de «Más» ve cada rol: épica de navegación.
- El desbloqueo, la aprobación, la desactivación y la reactivación de cuentas: épica de Usuarios y roles.
