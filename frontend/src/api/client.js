// Compilado (npm run build) lo sirve el mismo backend, así que la API está en el mismo lugar: '/api'.
// En desarrollo (npm run dev) el backend está aparte, en el puerto 3001.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

export async function apiFetch(ruta, opciones = {}) {
  const token = localStorage.getItem('token');
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  const datos = await respuesta.json();

  if (!respuesta.ok) {
    // Sesión vencida o cuenta desactivada: se vuelve al login
    if (respuesta.status === 401 && token && !ruta.startsWith('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    // Clave temporal: hay que cambiarla antes de seguir
    if (respuesta.status === 403 && datos.codigo === 'CAMBIAR_CLAVE') {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
      if (usuario) localStorage.setItem('usuario', JSON.stringify({ ...usuario, debe_cambiar_clave: true }));
      if (window.location.pathname !== '/cambiar-clave') window.location.href = '/cambiar-clave';
    }
    const error = new Error(datos.error || 'Error en la solicitud');
    error.codigo = datos.codigo;
    error.datos = datos;
    throw error;
  }
  return datos;
}