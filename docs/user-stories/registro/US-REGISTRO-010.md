---
id: US-REGISTRO-010
tipo: historia
epica: EP-REGISTRO
titulo: "[Web] Medidor de fuerza de la contraseña y sus cuatro reglas"
etiquetas: [web]
relacionadas: [US-REGISTRO-003, US-REGISTRO-013]
verificacion: ejecutada
cubre: ["/register"]
---

## Historia
Como persona que elige su contraseña de SIGPRO, quiero ver mientras escribo qué reglas cumple y con qué fuerza,
para crear una contraseña que pase la validación a la primera.

## Reglas
- El medidor muestra cuatro reglas, en este orden y con este texto: «Al menos 10 caracteres», «Una mayúscula y una minúscula», «Un número» y «Un símbolo». Una regla que se cumple se marca con ✓; una que no se cumple, con ·.
- «Al menos 10 caracteres» se cumple con diez o más caracteres. «Una mayúscula y una minúscula» necesita las dos. «Un símbolo» se cumple con un carácter que no es letra ni número (ver «Decisiones pendientes»).
- El medidor tiene cuatro barras y rellena tantas como reglas se cumplen.
- En la web, el texto de la fuerza está en la página pero no se ve en pantalla: solo lo leen los lectores de pantalla. Los ejemplos comprueban ese texto, no lo que se ve.
- La fuerza depende de las reglas cumplidas: ninguna, sin texto; una, «Débil»; dos, «Aceptable»; tres, «Buena»; las cuatro, «Fuerte».
- El medidor se actualiza mientras se escribe la contraseña.
- Escribir en «Contraseña» no envía el formulario.
- Preparación de cada fila: se reinicia el tenant `alumno01` con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`), y se abre `/register?tenant=alumno01` en un navegador sin ninguna sesión de SIGPRO guardada.

## Criterios de aceptación
```gherkin
Característica: Medidor de fuerza de la contraseña en la web

  Esquema del escenario: El medidor cuenta las reglas cumplidas y muestra la fuerza
    Dado que el tenant alumno01 está recién reiniciado y una persona sin sesión iniciada está en /register?tenant=alumno01
    Cuando escribe <contraseña> en «Contraseña»
    Entonces las reglas cumplidas son <reglas>
    Y la fuerza es <fuerza>
    Y el medidor rellena <barras> de sus cuatro barras

    Ejemplos:
      | contraseña | reglas | fuerza | barras |
      | (vacío) | (ninguna) | (ninguna) | 0 |
      | Abcdefghi | solo «Una mayúscula y una minúscula» | «Débil» | 1 |
      | abcdefghij | «Al menos 10 caracteres» | «Débil» | 1 |
      | Abcdefghij | «Al menos 10 caracteres» y «Una mayúscula y una minúscula» | «Aceptable» | 2 |
      | Abcdefghij1 | «Al menos 10 caracteres», «Una mayúscula y una minúscula» y «Un número» | «Buena» | 3 |
      | Abc1! | «Una mayúscula y una minúscula», «Un número» y «Un símbolo» | «Buena» | 3 |
      | Abcdefghij1! | las cuatro | «Fuerte» | 4 |
```

## Fuera de alcance
- Lo que pasa al enviar una contraseña que no cumple las reglas: historias de validación de esta misma épica en la web.
- La misma pantalla en la app móvil: historia de formulario móvil de esta misma épica.

## Decisiones pendientes
- Si la fuerza debe verse como texto en la web. Hoy el texto de la fuerza no se muestra en pantalla en la web, aunque sí en la app móvil.
- Si un espacio cuenta como símbolo. Hoy sí: un espacio cumple «Un símbolo». La historia no lo afirma en ningún ejemplo.
