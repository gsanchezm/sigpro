---
id: US-PROG-ALTA-011
tipo: historia
epica: EP-PROG-ALTA
titulo: "[Web] Avisos y accesos de la edición de un programa"
etiquetas: [web]
relacionadas: [US-PROG-ALTA-004, US-PROG-ALTA-010, US-PROG-ALTA-013]
verificacion: codigo
cubre: ["/programs/:code/edit"]
permisos: [program.edit]
---

## Historia
Como persona que edita un programa desde la web, quiero que la pantalla me diga por qué no se puede guardar un dato o por qué no puedo editar el programa,
para corregir el dato o pedir a quien gestiona el programa que lo haga.

## Reglas
- Un nombre que ya tiene otro programa del tenant, sin distinguir mayúsculas, o que contiene la palabra «duplicado», no se guarda. Aparece arriba el aviso «422 · Ya existe un programa con ese nombre» y el mismo texto bajo «Nombre». El programa conserva su nombre anterior.
- Un fin que no es posterior al inicio se comprueba en el propio formulario: aparece bajo «Fecha de fin» el aviso «La fecha de fin debe ser posterior al inicio», no se guarda nada y «Guardar» no envía la edición.
- Quien no puede editar, consultor y auditor, ve el título «Editar programa», el texto «Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.» y el enlace «Volver al detalle». No ve ningún campo para editar.
- Un código de programa que no existe en el tenant muestra «No se encontró el programa» y el enlace «Volver a Programas».
- Preparación de cada fila, en el tenant `alumno01`: se reinicia con `POST /api/admin/reset` y el token de `alumno01@sigpro.lab` (contraseña `Alumno1234!`). Después, la cuenta de la fila (`gestor@sigpro.test` con `Gestor1234!`, salvo que la fila diga otra) inicia sesión en `/login?tenant=alumno01` y llega a /programs. Las contraseñas de las otras cuentas son `Consul1234!` para `consultor@sigpro.test` y `Audit1234!` para `auditor@sigpro.test`.
- Tras el reinicio, `PRG-001` es «Sistema de mando táctico Ártemis», con inicio `2023-01-01` y fin `2024-07-01`. `PRG-002` es «Radar de vigilancia costera RVC-2».

## Criterios de aceptación
```gherkin
Característica: Avisos y accesos de la edición de un programa en la web

  Esquema del escenario: Un nombre repetido no se guarda y lo dice en el formulario
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit
    Cuando escribe <nombre> en «Nombre» y pulsa «Guardar»
    Entonces ve el aviso «422 · Ya existe un programa con ese nombre» arriba y el mismo texto bajo «Nombre», y el programa no cambia

    Ejemplos:
      | nombre |
      | Radar de vigilancia costera RVC-2 |
      | radar de vigilancia costera rvc-2 |
      | Programa DUPLICADO de prueba |

  Esquema del escenario: Un fin que no es posterior al inicio no se guarda
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha abierto /programs/PRG-001/edit
    Cuando escribe <inicio> en «Fecha de inicio», <fin> en «Fecha de fin» y pulsa «Guardar»
    Entonces <resultado>

    Ejemplos:
      | inicio | fin | resultado |
      | 2024-07-02 | 2024-07-01 | ve el aviso «La fecha de fin debe ser posterior al inicio» bajo «Fecha de fin» y no se guarda nada |
      | 2024-06-30 | 2024-07-01 | se guarda y ve el aviso «Programa actualizado» |

  Esquema del escenario: Quien no puede editar ve por qué y no ve el formulario
    Dado que en el tenant alumno01, recién reiniciado, <cuenta> ha iniciado sesión y abre /programs/PRG-001/edit
    Cuando observa la pantalla
    Entonces ve el título «Editar programa», el texto «Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.» y el enlace «Volver al detalle», y no ve ningún campo para editar

    Ejemplos:
      | cuenta |
      | consultor@sigpro.test |
      | auditor@sigpro.test |

  Esquema del escenario: Un programa que no existe en el tenant muestra el aviso de no encontrado
    Dado que en el tenant alumno01, recién reiniciado, gestor@sigpro.test ha iniciado sesión
    Cuando abre /programs/<codigo>/edit
    Entonces ve el aviso «No se encontró el programa» y el enlace «Volver a Programas»

    Ejemplos:
      | codigo |
      | PRG-999 |
      | PRG-025 |
```

## Fuera de alcance
- Los campos del formulario, sus valores guardados y los botones «Guardar» y «Guardar y cerrar»: EP-PROG-ALTA, historia de edición de un programa en la web.
- Las reglas de nombre, fechas y propietario cuando se edita por la API: EP-PROG-ALTA, historia de validación de la edición por la API.
- El control de acceso a la lista de programas y al botón de edición de la lista: EP-PROG-LISTA.

## Decisiones pendientes
- Si el aviso superior «422 · …» debe desaparecer cuando la persona corrige el campo que falla. Hoy el aviso superior sigue visible hasta el siguiente envío, mientras el aviso bajo el campo sí desaparece al corregirlo. No está decidido.
