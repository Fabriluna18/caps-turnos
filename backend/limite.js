// Freno contra adivinar contraseñas: 5 fallos seguidos bloquean 15 minutos
// (se cuenta por DNI y por conexión; se reinicia si el servidor se reinicia)
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const fallos = new Map();

// Devuelve los segundos que faltan para que se libere, o 0 si no está bloqueado
function bloqueado(clave) {
  const f = fallos.get(clave);
  if (!f || !f.hasta) return 0;
  const falta = f.hasta - Date.now();
  if (falta <= 0) {
    fallos.delete(clave);
    return 0;
  }
  return Math.ceil(falta / 1000);
}

function registrarFallo(clave) {
  const f = fallos.get(clave) || { cantidad: 0, hasta: 0, ultimo: 0 };
  f.cantidad += 1;
  f.ultimo = Date.now();
  if (f.cantidad >= MAX_FALLOS) f.hasta = Date.now() + BLOQUEO_MS;
  fallos.set(clave, f);
}

function limpiar(clave) {
  fallos.delete(clave);
}

// Limpieza periódica para que el mapa no crezca sin límite
setInterval(() => {
  const limite = Date.now() - 30 * 60 * 1000;
  for (const [clave, f] of fallos) {
    if (f.ultimo < limite && (!f.hasta || f.hasta < Date.now())) fallos.delete(clave);
  }
}, 10 * 60 * 1000).unref();

module.exports = { bloqueado, registrarFallo, limpiar };