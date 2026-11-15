// Fecha de hoy como AAAA-MM-DD, en la hora de la compu
export const hoyISO = () => new Date().toLocaleDateString('en-CA');

// "2026-12-25" -> "25/12/2026"
export function formatoFecha(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// "2026-12-25" -> "viernes"
export function diaDeSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' });
}