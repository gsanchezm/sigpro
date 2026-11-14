---
id: US-LOGIN-009
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Avisar de que el acceso con certificado digital o SSO no está disponible"
etiquetas: [web]
relacionadas: [US-LOGIN-005, US-LOGIN-010]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que prefiere entrar con su identidad corporativa, quiero que el botón de certificado digital o SSO me diga que esa opción no está disponible,
para usar el correo y la contraseña sin quedarme esperando.

## Reglas
- Pulsar «Acceder con certificado digital / SSO» muestra un aviso emergente informativo con el mensaje «SSO no disponible en el prototipo» y una línea de detalle técnico que contiene `GET /api/auth/sso → 501`.
- El mensaje y la línea de detalle técnico son criterios distintos; la línea muestra la petición HTTP real, como en el resto de avisos de Acceso. Es una decisión de diseño del laboratorio, no un diagnóstico.
- El aviso se cierra solo a los 3 segundos de aparecer.
- No se inicia ninguna sesión, se sigue en /login y no se borra lo escrito en el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada.

## Criterios de aceptación
```gherkin
Característica: Aviso de SSO no disponible en la web

  Esquema del escenario: El botón de SSO avisa de que no está disponible
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 tiene el formulario <escrito>
    Cuando pulsa «Acceder con certificado digital / SSO»
    Entonces en menos de 2 segundos ve el aviso informativo con el mensaje «SSO no disponible en el prototipo»
    Y la línea de detalle técnico del aviso contiene GET /api/auth/sso → 501
    Y sigue en /login sin sesión
    Y el formulario sigue <escrito>

    Ejemplos:
      | escrito |
      | (vacío) |
      | con el correo gestor@sigpro.test y la contraseña Gestor1234! |

  Esquema del escenario: El aviso se cierra solo a los 3 segundos
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 acaba de pulsar «Acceder con certificado digital / SSO» y ve el aviso «SSO no disponible en el prototipo»
    Cuando pasan <segundos> segundos desde que apareció
    Entonces el aviso <estado>

    Ejemplos:
      | segundos | estado |
      | 2 | sigue visible |
      | 4 | ya no está |
```

## Fuera de alcance
- El acceso con certificado digital o SSO como capacidad futura: historia `no-implementada` de la web en esta épica.
