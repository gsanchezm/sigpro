/** Iniciales de un nombre («Marta Ruiz» → «MR»; «Ana» → «A»; vacío → «»). */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
