import { Navigate } from 'react-router-dom';
import { usuarioActual } from '../auth';

export default function RutaProtegida({ roles, children }) {
  const token = localStorage.getItem('token');
  const usuario = usuarioActual();

  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (usuario.debe_cambiar_clave) return <Navigate to="/cambiar-clave" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={`/${usuario.rol}`} replace />;
  return children;
}