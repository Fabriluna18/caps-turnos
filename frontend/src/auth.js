export function usuarioActual() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

export function guardarSesion(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

// A dónde va una persona después de ingresar
export function rutaInicio(usuario) {
  return usuario.debe_cambiar_clave ? '/cambiar-clave' : `/${usuario.rol}`;
}