---
id: US-LOGIN-013
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Entrar con credenciales válidas"
etiquetas: [web]
relacionadas: [US-LOGIN-001, US-LOGIN-026]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona con una cuenta activa, quiero entrar en SIGPRO con mi correo y mi contraseña,
para empezar a trabajar en Programas con los permisos de mi rol.

## Reglas
- Mientras se espera la respuesta, el formulario se marca como ocupado y «Entrar» queda deshabilitado con la explicación «Procesando…» y un indicador de carga.
- Con credenciales válidas y una cuenta sin segundo factor aparece una pantalla de transición con «Sesión iniciada. Redirigiendo a Programas…» y el detalle «POST /api/auth/login → 200 · role=» seguido del rol de la cuenta (por ejemplo `role=program_manager`); al cabo de un momento se entra en /programs.
- Con una cuenta con segundo factor, en lugar de entrar se pasa al paso «Verificación en dos pasos».
- El correo se puede escribir con mayúsculas o con espacios al principio y al final.
- La sesión entra con el rol de la cuenta; la casilla «Mantener la sesión en este equipo» decide cuánto dura (US-LOGIN-019).

## Criterios de aceptación
```gherkin
Característica: Inicio de sesión en la web

  Esquema del escenario: Una cuenta activa entra en Programas
    Dado una persona sin sesión en /login
    Cuando escribe el correo <correo> y la contraseña "<contraseña>"
    Y pulsa "Entrar"
    Entonces ve "Sesión iniciada. Redirigiendo a Programas…" con el detalle "POST /api/auth/login → 200 · role=<rol>"
    Y llega a /programs

    Ejemplos:
      | correo | contraseña | rol |
      | gestor@sigpro.test | Gestor1234! | program_manager |
      | consultor@sigpro.test | Consul1234! | consultant |
      | auditor@sigpro.test | Audit1234! | auditor |
      | « GESTOR@sigpro.test » (con un espacio delante y otro detrás) | Gestor1234! | program_manager |

  Esquema del escenario: Una cuenta con segundo factor pasa a la verificación
    Dado una persona sin sesión en /login
    Cuando escribe el correo "<correo>" y la contraseña "<contraseña>"
    Y pulsa "Entrar"
    Entonces ve el título "<titulo>"
    Y sigue sin sesión hasta completar ese paso

    Ejemplos:
      | correo | contraseña | titulo |
      | admin@sigpro.test | Admin1234! | Verificación en dos pasos |

  Esquema del escenario: Mientras espera la respuesta no se puede volver a enviar
    Dado una persona sin sesión en /login que ha escrito "gestor@sigpro.test" y "Gestor1234!"
    Cuando pulsa "Entrar" y el servidor tarda <espera> en responder
    Entonces durante la espera "Entrar" está deshabilitado con la explicación "Procesando…"
    Y al llegar la respuesta ve "Sesión iniciada. Redirigiendo a Programas…"

    Ejemplos:
      | espera |
      | 1 segundo |
      | 3 segundos |
```

## Fuera de alcance
- El paso «Verificación en dos pasos» (épica del segundo factor).
