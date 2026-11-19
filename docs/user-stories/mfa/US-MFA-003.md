---
id: US-MFA-003
tipo: historia
epica: EP-MFA
titulo: "[Web] Completar o abandonar la verificación en dos pasos"
etiquetas: [web]
relacionadas: [US-MFA-001, US-LOGIN-007, US-MFA-004]
verificacion: ejecutada
cubre: ["/login"]
---

## Historia
Como persona que acaba de introducir correctamente su contraseña en la web y tiene segundo factor, quiero verificar mi código o volver al acceso,
para terminar el inicio de sesión solo cuando yo complete el segundo paso.

## Reglas
- Con `admin@sigpro.test` y `Admin1234!` en `alumno01`, la web muestra «Verificación en dos pasos» y el correo de la cuenta; el campo «Código de verificación» recibe el foco. Antes de verificar no hay sesión.
- El código solo admite dígitos y como máximo seis: lo que no es un dígito no se escribe y a partir del séptimo dígito no se admite más. «Verificar» está deshabilitado mientras falten dígitos y explica «Introduce los 6 dígitos del código».
- Con el código de demostración `123456`, se inicia la sesión y se llega a `/programs`. Con un código de seis dígitos que no es el de la cuenta, como `000000`, se queda en la verificación y se ve «Código incorrecto o caducado», sin sesión; se puede corregir el código e intentarlo de nuevo.
- «Volver al inicio de sesión» y la tecla Escape regresan al formulario de acceso sin completar la sesión.
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), se abre `/login?tenant=alumno01` en un navegador sin sesión y se envía `admin@sigpro.test` con `Admin1234!`. Cada fila parte de un contexto nuevo.

## Criterios de aceptación
```gherkin
Característica: Segundo paso en la web

  Esquema del escenario: Un código válido inicia sesión y uno inválido permite corregirlo
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando escribe <codigo> en «Código de verificación» y pulsa «Verificar»
    Entonces ve <resultado>

    Ejemplos:
      | codigo | resultado |
      | 123456 | «Sesión iniciada. Redirigiendo a Programas…» y después /programs |
      | 000000 | «Código incorrecto o caducado» y sigue sin sesión en la verificación |
      | 123457 | «Código incorrecto o caducado» y sigue sin sesión en la verificación |

  Esquema del escenario: Solo se envía un código de seis dígitos
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando escribe <entrada> en «Código de verificación»
    Entonces el campo contiene <contenido>
    Y «Verificar» está <estado>

    Ejemplos:
      | entrada | contenido | estado |
      | (vacío) | (vacío) | deshabilitado con la explicación «Introduce los 6 dígitos del código» |
      | 12345 | 12345 | deshabilitado con la explicación «Introduce los 6 dígitos del código» |
      | 12345a | 12345 | deshabilitado con la explicación «Introduce los 6 dígitos del código» |
      | abcdef | (vacío) | deshabilitado con la explicación «Introduce los 6 dígitos del código» |
      | 123456 | 123456 | habilitado |
      | 1234567 | 123456 | habilitado |

  Esquema del escenario: Tras un código incorrecto se puede corregir y volver a intentar
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Y ha escrito 000000 en «Código de verificación», ha pulsado «Verificar» y ve «Código incorrecto o caducado»
    Cuando sustituye ese código por <segundo_codigo> y pulsa «Verificar»
    Entonces ve <resultado>

    Ejemplos:
      | segundo_codigo | resultado |
      | 123456 | «Sesión iniciada. Redirigiendo a Programas…» y después /programs |
      | 111111 | «Código incorrecto o caducado» y sigue sin sesión en la verificación |

  Esquema del escenario: Se puede abandonar el segundo paso
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión ha llegado a «Verificación en dos pasos» para admin@sigpro.test
    Cuando usa <accion>
    Entonces vuelve a «Iniciar sesión» sin sesión abierta

    Ejemplos:
      | accion |
      | «Volver al inicio de sesión» |
      | la tecla Escape |
```

## Fuera de alcance
- El formulario de correo y contraseña anterior al segundo paso: EP-LOGIN.
- La duración de la sesión obtenida: EP-SESION.
