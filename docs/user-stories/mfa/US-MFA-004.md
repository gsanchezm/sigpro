---
id: US-MFA-004
tipo: historia
epica: EP-MFA
titulo: "[Móvil] Completar o abandonar la verificación en dos pasos"
etiquetas: [movil]
relacionadas: [US-MFA-001, US-LOGIN-012, US-MFA-003]
verificacion: ejecutada
cubre: ["/login"]
---

## Historia
Como persona que acaba de introducir correctamente su contraseña en la app móvil y tiene segundo factor, quiero verificar mi código o volver al formulario,
para terminar el inicio de sesión solo cuando yo complete el segundo paso.

## Reglas
- Con `admin@sigpro.test` y `Admin1234!` en el tenant `alumno01`, la app muestra «Verificación en dos pasos» y el correo de la cuenta; aún no hay sesión.
- «Código de verificación» abre un teclado numérico, solo conserva dígitos y como máximo seis. «Verificar» permanece deshabilitado mientras el código no tenga seis dígitos.
- Con el código de demostración `123456`, se abre la sesión y se llega a `/programs`. Con un código de seis dígitos que no es el de la cuenta, como `000000`, se ve «Código incorrecto o caducado», se permanece en la verificación sin sesión y se puede corregir el código e intentarlo de nuevo.
- «Volver al inicio de sesión» muestra otra vez el formulario de correo y contraseña sin completar la sesión.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), se abre `/login` en la app sin ninguna sesión de SIGPRO guardada en el dispositivo (en Expo web, en el navegador), se escribe `alumno01` en «Tenant de trabajo» y se envía `admin@sigpro.test` con `Admin1234!`.

## Criterios de aceptación
```gherkin
Característica: Segundo paso en la app móvil

  Esquema del escenario: El código completa la sesión o muestra un error corregible
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando escribe <codigo> en «Código de verificación» y pulsa «Verificar»
    Entonces <resultado>

    Ejemplos:
      | codigo | resultado |
      | 123456 | llega a /programs con una sesión abierta |
      | 000000 | ve «Código incorrecto o caducado» y sigue en la verificación sin sesión |
      | 123457 | ve «Código incorrecto o caducado» y sigue en la verificación sin sesión |

  Esquema del escenario: El código debe tener seis dígitos para enviarse
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando escribe <entrada> en «Código de verificación»
    Entonces el campo conserva <contenido>
    Y «Verificar» está <estado>

    Ejemplos:
      | entrada | contenido | estado |
      | (vacío) | (vacío) | deshabilitado |
      | 12345 | 12345 | deshabilitado |
      | 12345a | 12345 | deshabilitado |
      | abcdef | (vacío) | deshabilitado |
      | 123456 | 123456 | habilitado |
      | 1234567 | 123456 | habilitado |

  Esquema del escenario: Tras un código incorrecto se puede corregir y volver a intentar
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Y ha escrito 000000 en «Código de verificación», ha pulsado «Verificar» y ve «Código incorrecto o caducado»
    Cuando sustituye ese código por <segundo_codigo> y pulsa «Verificar»
    Entonces <resultado>

    Ejemplos:
      | segundo_codigo | resultado |
      | 123456 | llega a /programs con una sesión abierta |
      | 111111 | ve «Código incorrecto o caducado» y sigue en la verificación sin sesión |

  Esquema del escenario: Se puede volver al formulario de acceso
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando pulsa «Volver al inicio de sesión» después de escribir <codigo>
    Entonces vuelve a «Iniciar sesión» sin sesión abierta

    Ejemplos:
      | codigo |
      | (vacío) |
      | 12345 |
```

## Fuera de alcance
- El primer paso con correo y contraseña: EP-LOGIN.
- El comportamiento de los botones físicos de Android o los controles del sistema de iOS.
