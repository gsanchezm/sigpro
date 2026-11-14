---
id: US-LOGIN-007
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Iniciar sesión: entrar en Programas o ver por qué no se puede"
etiquetas: [web]
relacionadas: [US-LOGIN-001, US-LOGIN-002, US-LOGIN-003, US-LOGIN-006, US-LOGIN-012]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta en SIGPRO, quiero entrar con mi correo y mi contraseña o, si no puedo, ver un aviso claro de por qué y cuántas veces he fallado,
para empezar a trabajar con los permisos de mi rol o saber si debo corregir la contraseña, esperar una aprobación o pedir ayuda a un administrador.

## Reglas
- Mientras se espera la respuesta, el formulario se marca como ocupado y «Entrar» queda deshabilitado con la explicación «Procesando…» y un indicador de carga.
- Con credenciales válidas y una cuenta sin segundo factor aparece una pantalla de transición con el mensaje «Sesión iniciada. Redirigiendo a Programas…» y una línea de detalle técnico que contiene `POST /api/auth/login → 200` y `role=` seguido del rol de la cuenta; en menos de 5 segundos desde que se pulsó «Entrar» se está en /programs.
- Con una cuenta con segundo factor, en lugar de entrar se pasa al paso «Verificación en dos pasos», todavía sin sesión.
- El correo se puede escribir con mayúsculas o con espacios al principio y al final.
- Si el servidor rechaza el acceso, se sigue en /login sin sesión, con el correo y la contraseña escritos, y aparece encima de los campos un aviso de error con un mensaje y, debajo, una línea de detalle técnico:

  | Caso | Mensaje | La línea de detalle técnico contiene |
  | --- | --- | --- |
  | Credenciales incorrectas | «Correo o contraseña incorrectos» | `POST /api/auth/login → 401` y `attempts=N`, el número de intento fallido consecutivo |
  | Cuenta bloqueada, o el 5.º intento fallido consecutivo | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | `POST /api/auth/login → 423` |
  | Cuenta pendiente de aprobación | «Cuenta pendiente de aprobación. Revisa tu correo.» | `POST /api/auth/login → 403` |
  | Cuenta desactivada | «Tu cuenta está desactivada. Contacta con un administrador.» | `POST /api/auth/login → 403` |

- El mensaje y la línea de detalle técnico son criterios distintos. La línea es una función deliberada del laboratorio: muestra la petición HTTP real para relacionar la pantalla con la API. Es una decisión de diseño del laboratorio, no un diagnóstico.
- La cuenta se bloquea en el 5.º intento fallido consecutivo; con 4 sigue activa, y un acceso correcto antes del 5.º fallo entra y pone el contador a cero. Una cuenta bloqueada no entra ni con la contraseña correcta.
- Un correo sin cuenta se trata igual que una cuenta existente con la contraseña incorrecta, también en el 5.º intento, que muestra el aviso de cuenta bloqueada: ningún aviso revela si hay una cuenta con ese correo.
- Con una contraseña incorrecta, una cuenta pendiente o desactivada muestra el aviso de credenciales incorrectas: su estado solo se muestra con la contraseña correcta.
- El aviso de error desaparece al cambiar el correo o la contraseña.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada. Los fallos previos se provocan después del reinicio, en /login o con `POST /api/auth/login` (cabecera `x-tenant: alumno01`), con ese correo y una contraseña incorrecta. Para desactivar o reactivar `auditor@sigpro.test`, `alumno01@sigpro.lab` usa «Administración» o `PATCH /api/admin/users/u4` con `active: false` o `active: true`.
- En los ejemplos, `(correo sin cuenta)` es un correo nuevo en cada fila y en cada ejecución (`nadie-` seguido de una marca de tiempo y `@sigpro.test`), y sus fallos previos se envían en la propia fila. `(cuenta recién solicitada)` es una solicitud hecha en la propia fila en `/register?tenant=alumno01` con un correo nuevo (`nueva-` seguido de una marca de tiempo y `@organizacion.es`) y la contraseña `Abcdefghij1!`.

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión en la web

  Esquema del escenario: Una cuenta activa entra en «Programas»
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje «Sesión iniciada. Redirigiendo a Programas…»
    Y la línea de detalle técnico contiene POST /api/auth/login → 200 y role=<rol>
    Y en menos de 5 segundos llega a /programs

    Ejemplos:
      | correo | contraseña | rol |
      | gestor@sigpro.test | Gestor1234! | program_manager |
      | consultor@sigpro.test | Consul1234! | consultant |
      | auditor@sigpro.test | Audit1234! | auditor |
      | (GESTOR@sigpro.test con un espacio delante y otro detrás) | Gestor1234! | program_manager |

  Esquema del escenario: Una cuenta con segundo factor pasa a la verificación
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /login?tenant=alumno01
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el título <titulo>
    Y no tiene sesión iniciada hasta completar ese paso

    Ejemplos:
      | correo | contraseña | titulo |
      | admin@sigpro.test | Admin1234! | «Verificación en dos pasos» |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 ha escrito gestor@sigpro.test y Gestor1234!
    Y la prueba retrasa <espera> la respuesta de POST /api/auth/login en el navegador
    Cuando pulsa «Entrar»
    Entonces durante la espera el formulario está ocupado y «Entrar» está deshabilitado con la explicación «Procesando…»
    Y en menos de 5 segundos desde que llega la respuesta ve el mensaje «Sesión iniciada. Redirigiendo a Programas…»

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |

  Esquema del escenario: Las credenciales incorrectas muestran el número de intento
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el aviso de error con el mensaje «Correo o contraseña incorrectos»
    Y la línea de detalle técnico contiene POST /api/auth/login → 401 y attempts=<intento>
    Y sigue en /login sin sesión, con ese correo escrito

    Ejemplos:
      | correo | fallos_previos | contraseña | intento |
      | gestor@sigpro.test | 0 | incorrecta | 1 |
      | gestor@sigpro.test | 1 | incorrecta | 2 |
      | gestor@sigpro.test | 3 | incorrecta | 4 |
      | (correo sin cuenta) | 0 | incorrecta | 1 |
      | (correo sin cuenta) | 1 | Gestor1234! | 2 |
      | (correo sin cuenta) | 3 | incorrecta | 4 |
      | pendiente@sigpro.test | 0 | incorrecta | 1 |

  Esquema del escenario: El quinto intento fallido consecutivo bloquea la cuenta
    Dado que en el tenant alumno01, recién reiniciado, <correo> acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje <mensaje>
    Y la línea de detalle técnico contiene <detalle>
    Y sigue en /login sin sesión

    Ejemplos:
      | correo | fallos_previos | contraseña | mensaje | detalle |
      | gestor@sigpro.test | 3 | incorrecta | «Correo o contraseña incorrectos» | POST /api/auth/login → 401 |
      | gestor@sigpro.test | 4 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | POST /api/auth/login → 423 |
      | gestor@sigpro.test | 5 | Gestor1234! | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | POST /api/auth/login → 423 |
      | (correo sin cuenta) | 4 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | POST /api/auth/login → 423 |
      | (correo sin cuenta) | 5 | incorrecta | «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.» | POST /api/auth/login → 423 |

  Esquema del escenario: Con menos de 5 fallos la cuenta sigue activa y la contraseña correcta entra
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test acumula <fallos_previos> intentos fallidos consecutivos
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña Gestor1234!
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje «Sesión iniciada. Redirigiendo a Programas…»
    Y la línea de detalle técnico contiene POST /api/auth/login → 200
    Y en menos de 5 segundos más llega a /programs

    Ejemplos:
      | fallos_previos |
      | 3 |
      | 4 |

  Esquema del escenario: Una cuenta bloqueada no entra ni con su contraseña
    Dado que en el tenant alumno01, recién reiniciado, la cuenta bloqueado@sigpro.test está bloqueada
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje «Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.»
    Y la línea de detalle técnico contiene POST /api/auth/login → 423
    Y sigue en /login sin sesión

    Ejemplos:
      | contraseña |
      | Block1234! |
      | incorrecta |

  Esquema del escenario: Una cuenta pendiente de aprobación o desactivada no entra y lo dice
    Dado que en el tenant alumno01, recién reiniciado, la cuenta <correo> está <estado>
    Cuando en /login?tenant=alumno01 escribe ese correo y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces en menos de 5 segundos ve el mensaje <mensaje>
    Y la línea de detalle técnico contiene <detalle>

    Ejemplos:
      | correo | estado | contraseña | mensaje | detalle |
      | pendiente@sigpro.test | pendiente de aprobación | Pend1234! | «Cuenta pendiente de aprobación. Revisa tu correo.» | POST /api/auth/login → 403 |
      | (cuenta recién solicitada) | pendiente de aprobación | Abcdefghij1! | «Cuenta pendiente de aprobación. Revisa tu correo.» | POST /api/auth/login → 403 |
      | auditor@sigpro.test | desactivada | Audit1234! | «Tu cuenta está desactivada. Contacta con un administrador.» | POST /api/auth/login → 403 |
      | auditor@sigpro.test | desactivada | incorrecta | «Correo o contraseña incorrectos» | POST /api/auth/login → 401 |
      | auditor@sigpro.test | desactivada y vuelta a activar | Audit1234! | «Sesión iniciada. Redirigiendo a Programas…» | POST /api/auth/login → 200 |

  Esquema del escenario: El aviso de error desaparece al corregir los datos
    Dado que el tenant alumno01 está recién reiniciado y una persona en /login?tenant=alumno01 ha escrito gestor@sigpro.test con la contraseña incorrecta, ha pulsado «Entrar» y ve el aviso «Correo o contraseña incorrectos»
    Cuando cambia el contenido del campo <campo>
    Entonces en menos de 1 segundo deja de ver el aviso de error

    Ejemplos:
      | campo |
      | «Correo electrónico» |
      | «Contraseña» |
```

## Fuera de alcance
- El paso «Verificación en dos pasos»: épica del segundo factor (MFA).
- El desbloqueo, la aprobación, la desactivación y la reactivación de cuentas: épica de Usuarios y roles.
- Los avisos de error genéricos (sin conexión o error inesperado del servidor) y el panel «Usuarios de prueba».
