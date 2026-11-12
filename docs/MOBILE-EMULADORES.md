# SIGPRO móvil en emuladores (iOS y Android)

La app móvil (`apps/mobile`, Expo) se puede usar de tres formas: en el navegador (`pnpm --filter mobile web`, :8081), con Expo Go en un teléfono, o instalando una **build para emulador**. Esta guía es la tercera: un `.app` zipeado para el Simulador de iOS y un `.apk` para el emulador de Android, sin cuenta de Expo ni de Apple.

> **Estado (2026-11-12):** el workflow se ejecutó en GitHub con la app funcional completa (run 43256654130) y produjo el `.app` de iOS (`x86_64 arm64`) y el APK de Android (`x86_64`, `arm64-v8a`), ambos con la URL de la API dentro del bundle. El APK se instaló y se usó en un emulador de Android (API 33): login con MFA, Programas, el asistente de «Nuevo programa» con un selector modal anidado y Verificación funcionan, con Geist y las sombras bien. **Sin verificar:** el `.app` en un Simulador de iOS (hace falta un Mac) y, en nativo, los selectores de imágenes y de documentos, la hoja de compartir y la descarga de archivos.

## 1. Obtener la build

1. En GitHub: **Actions → Mobile builds (emuladores) → Run workflow**. O desde la terminal: `gh workflow run mobile-builds.yml`.
2. Parámetros (todos opcionales):

| Parámetro | Por defecto | Para qué |
| --- | --- | --- |
| `platforms` | `both` | `ios`, `android` o ambos |
| `ios_api_url` | `http://localhost:3000/api` | La API que verá el simulador de iOS (`localhost` es tu Mac) |
| `android_api_url` | `http://10.0.2.2:3000/api` | La API que verá el emulador de Android (`10.0.2.2` es la máquina anfitriona) |
| `tenant` | `demo` | Tenant por defecto de la pantalla de acceso (`alumno01`…) |
| `ios_archs` | `arm64 x86_64` | Mac Apple Silicon (`arm64`) y/o Intel (`x86_64`) |

La URL de la API **se incrusta al compilar**: una build con `localhost` no llega a Render. Para usar Render, lanza el workflow con `ios_api_url`/`android_api_url` = `https://<tu-api>.onrender.com/api`.

3. Cuando termine (iOS tarda 20–40 min por los *pods*), descarga los artefactos del run: `sigpro-ios-simulator` y `sigpro-android-emulator`. GitHub los entrega dentro de otro zip: descomprímelo una vez.

## 2. iOS (Simulador de Xcode, solo macOS)

```bash
unzip sigpro-ios-simulator.zip            # deja SIGPRO.app
xcrun simctl boot "iPhone 16"             # o abre el Simulador y arranca uno
xcrun simctl install booted SIGPRO.app    # o arrastra SIGPRO.app a la ventana del simulador
xcrun simctl launch booted dev.sigpro.lab
```

Con la API local (`docker compose up -d db` y `pnpm --filter api start`) el simulador llega a `http://localhost:3000` tal cual. El `.app` es de **Release** (lleva el JavaScript dentro) y no está firmado: solo sirve para simuladores, no para un iPhone.

## 3. Android (emulador de Android Studio)

```bash
adb install -r sigpro-android-emulator.apk
adb shell monkey -p dev.sigpro.lab 1      # o ábrela desde el lanzador
```

El APK lleva las ABI `x86_64` (PC y Mac Intel) y `arm64-v8a` (Mac Apple Silicon). Permite HTTP sin cifrar (`usesCleartextTraffic`) para llegar a `http://10.0.2.2:3000`.

## 4. Si prefieres compilar en tu máquina

- **Mac:** `cd apps/mobile && pnpm exec expo run:ios` (Xcode) o `pnpm exec expo run:android` (Android Studio). Define antes `EXPO_PUBLIC_API_URL`.
- **Windows/Linux:** solo Android. iOS exige macOS y Xcode: por eso el workflow usa un runner de macOS.
- `apps/mobile/ios` y `apps/mobile/android` los genera `expo prebuild`; están en `.gitignore` y no se versionan, igual que las builds (no las subas al repositorio).

## 5. Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| La app abre pero el acceso dice «No se pudo contactar con el servidor» | La API no está en marcha, o la URL incrustada no es la de tu entorno: relanza el workflow con la URL correcta |
| En Android, el mismo error aunque la API responde en el navegador | Usaste `localhost` en vez de `10.0.2.2` |
| El simulador no instala el `.app` | Compilaste solo una arquitectura que no es la de tu Mac: relanza con `ios_archs` = `arm64 x86_64` |
| Los textos salen con otra tipografía | Geist no cargó; la app sigue funcionando con la fuente del sistema |
