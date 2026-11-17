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
- Pulsar «Acceder con certificado digital / SSO» muestra un aviso emergente informativo con el mensaje «SSO no disponible en el prototipo».
- El aviso se cierra solo a los 3 segundos de aparecer.
- No se inicia ninguna sesión, se sigue en /login y no se borra lo escrito en el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de acceso de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/login?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada.

## Criterios de aceptación
```gherkin
Característica: Aviso de SSO no disponible en la web

  Esquema del escenario: El botón de SSO avisa de que no está disponible
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada en /login?tenant=alumno01 tiene el formulario <escrito>
    Cuando pulsa «Acceder con certificado digital / SSO»
    Entonces ve el aviso informativo con el mensaje «SSO no disponible en el prototipo»
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

## Decisiones pendientes
- **Línea de detalle técnico visible.** Hoy el aviso emergente de SSO muestra, bajo el mensaje, una línea con la petición HTTP real (método, ruta y código de estado de la petición a `GET /api/auth/sso`, con algún dato más). Está pendiente de decisión de producto si esa línea forma parte del producto y qué debe contener. Hasta que se decida, ningún ejemplo de esta historia la afirma ni la excluye, y las pruebas no deben depender de ella.

## Fuera de alcance
- El acceso con certificado digital o SSO como capacidad futura: historia `no-implementada` de la web en esta épica.
