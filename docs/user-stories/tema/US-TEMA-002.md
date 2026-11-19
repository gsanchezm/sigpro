---
id: US-TEMA-002
tipo: historia
epica: EP-TEMA
titulo: "[Web] Empezar en tema claro y conservar el tema elegido al recargar y al entrar"
etiquetas: [web]
relacionadas: [US-TEMA-001, US-TEMA-005, US-LOGIN-007, US-PERFIL-002]
verificacion: codigo
---

## Historia
Como persona que abre SIGPRO en un navegador donde nunca ha elegido tema, quiero verlo en tema claro y, si cambio el tema, seguir viéndolo así al recargar la página y al pasar de Acceso a la aplicación,
para no tener que volver a elegirlo cada vez que entro.

## Reglas
- Sin preferencia de tema guardada en el navegador, la web muestra el tema claro, aunque el sistema o el navegador pidan el tema oscuro.
- Lo que se elige con «Cambiar tema» queda guardado en el navegador al pulsarlo.
- Lo guardado se aplica a cada página que se abre después, también tras recargar la página: no hace falta volver a elegirlo.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Cada fila empieza en un navegador nuevo, sin preferencia de tema guardada. El tema del sistema se fija en la prueba cuando la fila lo indica.

## Criterios de aceptación
```gherkin
Característica: Tema inicial y tema conservado en la web

  Esquema del escenario: Sin preferencia guardada la web muestra el tema claro
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada abre <ruta> en un navegador nuevo con el tema del sistema en <tema_sistema>
    Entonces el tema es claro
    Y el atributo data-theme del documento vale light

    Ejemplos:
      | ruta | tema_sistema |
      | /login?tenant=alumno01 | claro |
      | /login?tenant=alumno01 | oscuro |
      | /legal/terms | oscuro |

  Esquema del escenario: El tema elegido sigue al recargar la página
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01 en un navegador nuevo
    Cuando <accion> y recarga la página
    Entonces el tema es <tema>
    Y el atributo data-theme del documento vale <valor>

    Ejemplos:
      | accion | tema | valor |
      | no pulsa «Cambiar tema» | claro | light |
      | pulsa «Cambiar tema» una vez | oscuro | dark |
      | pulsa «Cambiar tema» dos veces | claro | light |
      | pulsa «Cambiar tema» tres veces | oscuro | dark |

  Esquema del escenario: El tema elegido se mantiene al entrar en la aplicación
    Dado que en el tenant alumno01, recién reiniciado, una persona sin sesión iniciada está en /login?tenant=alumno01 en un navegador nuevo y ha pulsado «Cambiar tema» <pulsaciones>
    Cuando escribe gestor@sigpro.test en «Correo electrónico» y Gestor1234! en «Contraseña», y pulsa «Entrar»
    Entonces llega a /programs con el tema <tema>
    Y el atributo data-theme del documento vale <valor>

    Ejemplos:
      | pulsaciones | tema | valor |
      | una vez | oscuro | dark |
      | dos veces | claro | light |
```

## Fuera de alcance
- El formulario de acceso y sus avisos: US-LOGIN-007, de EP-LOGIN.
- El grupo «Tema» de Perfil y su «Guardar»: US-PERFIL-002, de EP-PERFIL.
- Lo que ocurre con el tema al cerrar sesión o al entrar con otra cuenta: US-TEMA-005.
- El control para cambiar el tema: US-TEMA-001.
