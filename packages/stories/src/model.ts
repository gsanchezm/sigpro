// Modelo de las historias de usuario: constantes, esquemas del front matter y tipos de archivo.
// Es puro: ningún efecto, solo datos y validación.
import { z } from 'zod';

/** Etiquetas de plataforma: cada historia lleva exactamente una. */
export const PLATFORM_LABELS = ['api', 'web', 'movil', 'ios', 'android', 'transversal'] as const;

/** Etiquetas que no son de plataforma: `epic` marca la épica, `no-implementada` se suma a una historia. */
export const EXTRA_LABELS = ['epic', 'no-implementada'] as const;

/** Cómo se comprueba la historia contra la app (no se publica en GitHub). */
export const VERIFICATION = ['ejecutada', 'codigo', 'pendiente-nativo', 'no-ejecutable'] as const;

export type PlatformLabel = (typeof PLATFORM_LABELS)[number];
export type Verification = (typeof VERIFICATION)[number];

/** Prefijo del título del issue según la plataforma. */
export const TITLE_PREFIX: ReadonlyMap<PlatformLabel, string> = new Map<PlatformLabel, string>([
  ['api', '[API]'],
  ['web', '[Web]'],
  ['movil', '[Móvil]'],
  ['ios', '[iOS]'],
  ['android', '[Android]'],
  ['transversal', '[Transversal]'],
]);

/** Etiquetas de GitHub que crea la sincronización (color en hexadecimal sin `#`, descripción de hasta 100 caracteres). */
export const LABEL_DEFS: readonly { name: string; color: string; description: string }[] = [
  { name: 'epic', color: '5319e7', description: 'Issue padre que agrupa las historias de una funcionalidad' },
  { name: 'api', color: '0e8a16', description: 'Endpoints, códigos HTTP, validación en servidor y permisos' },
  { name: 'web', color: '1d76db', description: 'Interfaz web de escritorio y diseño responsive' },
  { name: 'movil', color: 'fbca04', description: 'App Expo común a iOS y Android' },
  { name: 'ios', color: '5e6065', description: 'Comportamiento que difiere solo en iOS' },
  { name: 'android', color: '3ddc84', description: 'Comportamiento que difiere solo en Android' },
  { name: 'transversal', color: 'c5def5', description: 'Regla válida en todas las plataformas, sin interfaz ni endpoint propios' },
  { name: 'no-implementada', color: 'd93f0b', description: 'Capacidad ausente o solo simulada en la app: material de lectura, no se puede probar' },
];

const EPIC_ID = /^EP-[A-Z0-9-]+$/;
const STORY_ID = /^US-[A-Z0-9-]+-\d{3}$/;

/** Front matter de `epic.md`. La épica lleva solo la etiqueta `epic`. */
export const epicFrontmatterSchema = z
  .object({
    id: z.string().regex(EPIC_ID),
    tipo: z.literal('epica'),
    titulo: z.string().min(1),
    etiquetas: z.tuple([z.literal('epic')]),
  })
  .strict();

/**
 * Front matter de una historia. `cubre` lista endpoints ("POST /api/auth/login") o rutas ("/login")
 * según la plataforma; `permisos` lista claves de `PERMISSIONS` de `@sigpro/shared`.
 * Que haya una sola etiqueta de plataforma y que las referencias existan lo comprueban las reglas de lint.
 */
export const storyFrontmatterSchema = z
  .object({
    id: z.string().regex(STORY_ID),
    tipo: z.literal('historia'),
    epica: z.string().regex(EPIC_ID),
    titulo: z.string().min(1),
    etiquetas: z.array(z.string()),
    relacionadas: z.array(z.string()).optional(),
    verificacion: z.enum(VERIFICATION),
    cubre: z.array(z.string()).optional(),
    permisos: z.array(z.string()).optional(),
  })
  .strict();

export type EpicFrontmatter = z.infer<typeof epicFrontmatterSchema>;
export type StoryFrontmatter = z.infer<typeof storyFrontmatterSchema>;

/** Archivo de épica o de historia ya leído y validado; `body` es el Markdown bajo el front matter. */
export type StoryFile =
  | { kind: 'epic'; path: string; fm: EpicFrontmatter; body: string }
  | { kind: 'story'; path: string; fm: StoryFrontmatter; body: string };
