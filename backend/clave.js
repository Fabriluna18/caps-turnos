const crypto = require('crypto');

// Sin caracteres que se confunden (0/O, 1/l/I)
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function claveTemporal() {
  return Array.from({ length: 10 }, () => LETRAS[crypto.randomInt(LETRAS.length)]).join('');
}

module.exports = { claveTemporal };