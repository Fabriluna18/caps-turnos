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

// "1990-05-14" -> 36 (años cumplidos hoy)
export function edad(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios -= 1;
  return anios;
}

// Suma (o resta) días a una fecha AAAA-MM-DD
export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];