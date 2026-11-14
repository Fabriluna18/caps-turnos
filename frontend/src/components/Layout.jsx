import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { cerrarSesion, usuarioActual } from '../auth';
import { MENUS } from '../menus';

const ROLES = { secretaria: 'Secretaría', medico: 'Médico', paciente: 'Paciente' };

export default function Layout() {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const menu = MENUS[usuario.rol];
  const base = `/${usuario.rol}`;

  const salir = () => {
    cerrarSesion();
    navigate('/login');
  };

  return (
    <div className="app">
      <aside className="lateral">
        <div className="lateral-marca">
          <span>CAPS</span>
          <small>Sistema de turnos</small>
        </div>

        <nav>
          {menu.map(({ a, texto, icono: Icono }) => (
            <NavLink key={texto} to={a ? `${base}/${a}` : base} end={!a}>
              <Icono size={18} /> {texto}
            </NavLink>
          ))}
        </nav>

        <div className="lateral-usuario">
          <strong>{usuario.nombre} {usuario.apellido}</strong>
          <span>{ROLES[usuario.rol]}</span>
          <Link to="/cambiar-clave"><KeyRound size={14} /> Cambiar contraseña</Link>
          <button onClick={salir}><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}