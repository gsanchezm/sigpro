# Builds móviles publicados como Release de GitHub (2026-11-25)

Diseño corto, **aprobado por el usuario el 2026-11-25**. Tamaño: cambio pequeño (un workflow y su documentación).

## Intención

OmniPizza publica sus builds de iOS (simulador) y Android (APK) como **Release de GitHub**: un tag, notas y los archivos descargables en la página del repo. SIGPRO ya compila lo mismo con `.github/workflows/mobile-builds.yml` (ejecutado con éxito el 2026-11-12, run 43256654130 y siguientes), pero deja el resultado solo como **artefactos del run**: caducan a los 30 días, exigen sesión de GitHub y llegan dentro de otro zip. Se quiere el mismo flujo que OmniPizza: descargar `sigpro-android-emulator.apk` y `sigpro-ios-simulator.zip` desde Releases.

## Objetivos

- Lanzar el workflow con una versión (`v1.0.0`) y obtener una Release con tag, notas y los dos archivos.
- Poder probarlo primero sin publicar nada (borrador).
- Que sin versión el workflow siga como hoy (solo artefactos), para las pruebas rápidas.

## No objetivos

- Firmar, distribuir por tiendas o usar EAS/Expo (la guía actual ya promete «sin cuenta de Expo ni de Apple»).
- Compilar iOS para dispositivo real.
- Replicar `omnipizza-debug-androidTest.apk` (no lo produce el workflow de OmniPizza que se leyó).
- Cambiar la app móvil.

## Anti-objetivos (lo que lo haría fracasar aunque «funcione»)

- Publicar algo público sin orden explícita del usuario (el repo `gsanchezm/sigpro` es público; un tag y una Release notifican).
- Pisar un tag o una Release que ya existen.
- Que el job de release se ejecute con una versión mal escrita.

## Restricciones

- Los jobs de compilación (`ios-simulator` en `macos-latest`, `android-emulator` en `ubuntu-latest`) **no se tocan** salvo lo imprescindible: están verificados en GitHub.
- La URL de la API se incrusta al compilar (`EXPO_PUBLIC_API_URL`); los valores por defecto siguen siendo `http://localhost:3000/api` (iOS) y `http://10.0.2.2:3000/api` (Android).
- Pnpm 11, Node 22. Sin versiones de acciones nuevas más allá de la del release (`softprops/action-gh-release@v2`, la que usa OmniPizza).

## Enfoques considerados

1. **Ampliar `mobile-builds.yml` con un job `release` opcional (elegido).** Un solo sitio donde viven los pasos de iOS y Android; sin `version` todo queda igual que hoy. *Contra:* el workflow gana inputs.
2. **Copiar el `mobile-release.yml` de OmniPizza como workflow aparte.** *Descartado:* duplica los pasos de prebuild, xcodebuild y gradle (ya verificados) y los dos se desincronizarían.
3. **Disparar con `push` de un tag `v*`.** *Descartado:* no hay forma de probar sin publicar, y el usuario pidió el flujo de OmniPizza (lanzar a mano con la versión).
4. **EAS Build.** *Descartado:* exige cuenta de Expo.

## Diseño

Cambios en `.github/workflows/mobile-builds.yml`:

1. Inputs nuevos: `version` (texto, vacío por defecto), `release_notes` (texto) y `draft` (booleano). `permissions: contents: write` solo en el job `release`.
2. Un job previo `prepare` (ubuntu, barato) que, si hay `version`: valida `^v[0-9]+\.[0-9]+\.[0-9]+$` y comprueba con `gh release view` y `git ls-remote --tags` que ni la Release ni el tag existen. Falla antes de gastar minutos de macOS. Sin `version` no hace nada.
3. En ambos jobs de compilación, si hay `version`, un paso antes de `expo prebuild` pone `expo.version` = versión sin la `v` (no se commitea), para que la app y la Release digan lo mismo.
4. Job `release` (ubuntu): corre si hay `version` y los jobs de compilación pedidos terminaron bien (el omitido por `platforms` no cuenta). Descarga los artefactos que existan y los publica con `softprops/action-gh-release@v2`: `tag_name` = versión, `target_commitish` = `github.sha`, nombre `SIGPRO <versión>`, `draft` según el input, `generate_release_notes: true`, cuerpo con `release_notes` más un párrafo fijo (qué API traen los archivos y enlace a `docs/MOBILE-EMULADORES.md`).
5. Con `draft: true` la Release queda como borrador (sin tag público) para la primera prueba.

Documentación: `docs/MOBILE-EMULADORES.md` §1 gana «Descargar de Releases»; STATUS, CHANGELOG y DECISIONS recogen el cambio.

## Decisiones del usuario

- Aprobó el diseño completo el 2026-11-25. Sugerí dejar la URL de la API por defecto en local; invitó a corregirlo y no lo corrigió.

## Llamadas mías (marcadas para revisar)

- `version` opcional en vez de obligatorio (conserva el uso actual).
- Poner `expo.version` desde el tag, sin commitear.
- Job `prepare` aparte para fallar pronto.
- `draft` como input para la primera prueba.

## Queda al constructor

- Texto exacto del párrafo fijo del cuerpo de la Release.
- Cómo pasar la versión entre jobs (outputs).
- Qué hacer con `platforms` = `ios` o `android` en el job `release` (publicar solo lo que se compiló).

## Verificación

YAML válido en local (parser `yaml` del repo) y revisión de la lógica de condiciones. **La prueba real exige lanzarlo en GitHub**: eso cambia el repo público, así que se pide permiso antes del push y antes de lanzarlo, y el primer lanzamiento es con `draft: true`.
