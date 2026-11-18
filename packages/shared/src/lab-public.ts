/**
 * Compilación «laboratorio cerrado».
 *
 * Con `VITE_LAB_PUBLIC=false` al compilar la web (la sustituye Vite como `__SIGPRO_LAB_PUBLIC__` en tiempo de build; ver
 * `apps/web/vite.config.ts`), los textos que citan las credenciales de demo (código MFA, correos de prueba, contraseña del
 * alumno) se sustituyen por otros neutros Y LOS ORIGINALES DESAPARECEN DEL JAVASCRIPT PUBLICADO: un sitio estático no puede
 * esconder nada que viaje en su bundle. Lo comprueba `pnpm check:bundle`.
 *
 * Fuera de esa compilación (API en Node, app móvil, desarrollo local, despliegues sin la variable) la constante vale `true` y
 * todo es como siempre.
 */
declare const __SIGPRO_LAB_PUBLIC__: boolean | undefined;

export const LAB_PUBLIC: boolean = typeof __SIGPRO_LAB_PUBLIC__ === 'undefined' || __SIGPRO_LAB_PUBLIC__;
