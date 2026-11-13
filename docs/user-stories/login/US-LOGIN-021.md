---
id: US-LOGIN-021
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Avisar de que el acceso con SSO no está disponible"
etiquetas: [web]
relacionadas: [US-LOGIN-010, US-LOGIN-022]
verificacion: codigo
cubre: ["/login"]
---

## Historia
Como persona que prefiere entrar con su certificado digital, quiero que el botón de SSO me diga que esa opción no está disponible,
para usar el correo y la contraseña sin quedarme esperando.

## Reglas
- Pulsar «Acceder con certificado digital / SSO» muestra un aviso emergente informativo con el título «SSO no disponible en el prototipo» y el detalle «GET /api/auth/sso → 501 Not Implemented».
- El aviso se cierra solo a los 3 segundos.
- No se inicia ninguna sesión, se sigue en /login y no se borra lo escrito en el formulario.

## Criterios de aceptación
```gherkin
Característica: Aviso de SSO no disponible en la web

  Esquema del escenario: El botón de SSO avisa de que no está disponible
    Dado que una persona sin sesión en /login tiene el formulario <escrito>
    Cuando pulsa «Acceder con certificado digital / SSO»
    Entonces ve el aviso informativo «SSO no disponible en el prototipo» con el detalle «GET /api/auth/sso → 501 Not Implemented»
    Y sigue en /login sin sesión
    Y el formulario sigue <escrito>

    Ejemplos:
      | escrito |
      | (vacío) |
      | con el correo gestor@sigpro.test y la contraseña Gestor1234! |

  Esquema del escenario: El aviso se cierra solo a los 3 segundos
    Dado que acaba de aparecer el aviso «SSO no disponible en el prototipo»
    Cuando pasan <segundos> segundos
    Entonces el aviso <estado>

    Ejemplos:
      | segundos | estado |
      | 2 | sigue visible |
      | 4 | ya no está |
```

## Fuera de alcance
- El acceso con SSO que se debió construir (US-LOGIN-022).
