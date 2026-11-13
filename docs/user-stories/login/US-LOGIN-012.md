---
id: US-LOGIN-012
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Validar el correo y la contraseña antes de enviar"
etiquetas: [web]
relacionadas: [US-LOGIN-002, US-LOGIN-025]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que inicia sesión en la web, quiero saber qué campo está mal antes de enviar el formulario,
para corregirlo sin esperar al servidor y sin gastar un intento.

## Reglas
- Al pulsar «Entrar», si algún campo no es válido, el formulario no se envía y cada campo con problema muestra su aviso debajo y queda marcado como no válido.
- «Correo electrónico» es obligatorio («Campo obligatorio»); se ignoran los espacios del principio y del final, así que un correo de solo espacios está vacío.
- El correo debe tener la forma `texto@dominio.extensión`, sin espacios y con una sola `@` («Introduce un correo válido»).
- «Contraseña» es obligatoria («Campo obligatorio»); basta con un carácter, y un espacio cuenta como carácter.
- Las reglas son las mismas que aplica el servidor.
- Al cambiar el correo o la contraseña desaparecen los avisos de los campos.
- En los ejemplos, `(correo sin cuenta)` es un correo que nunca se ha usado en ese tenant, como `nadie-` seguido de una marca de tiempo y `@sigpro.test`.

## Criterios de aceptación
```gherkin
Característica: Validación del formulario de acceso en la web

  Esquema del escenario: Cada campo no válido muestra su aviso y no se envía nada
    Dado que una persona sin sesión está en /login
    Cuando escribe el correo <correo> y la contraseña <contraseña>
    Y pulsa «Entrar»
    Entonces bajo el correo ve <aviso_correo>
    Y bajo la contraseña ve <aviso_contraseña>
    Y <envio>

    Ejemplos:
      | correo | contraseña | aviso_correo | aviso_contraseña | envio |
      | (vacío) | (vacío) | «Campo obligatorio» | «Campo obligatorio» | no se envía el formulario |
      | (tres espacios) | Gestor1234! | «Campo obligatorio» | (ninguno) | no se envía el formulario |
      | no-es-un-correo | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | ana@sigpro | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | @sigpro.test | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | (ana @sigpro.test, con un espacio antes de la arroba) | Gestor1234! | «Introduce un correo válido» | (ninguno) | no se envía el formulario |
      | gestor@sigpro.test | (vacío) | (ninguno) | «Campo obligatorio» | no se envía el formulario |
      | gestor@sigpro.test | (un espacio) | (ninguno) | (ninguno) | se envía y el servidor responde «Correo o contraseña incorrectos» |
      | (correo sin cuenta) | x | (ninguno) | (ninguno) | se envía y el servidor responde «Correo o contraseña incorrectos» |
      | gestor@sigpro.test | Gestor1234! | (ninguno) | (ninguno) | se envía y se inicia la sesión |

  Esquema del escenario: Editar un campo borra los avisos
    Dado que tras pulsar «Entrar» con los dos campos vacíos ve «Campo obligatorio» bajo el correo y bajo la contraseña
    Cuando escribe <texto> en el campo <campo>
    Entonces ya no ve ningún aviso bajo los campos

    Ejemplos:
      | campo | texto |
      | «Correo electrónico» | g |
      | «Contraseña» | x |
```
