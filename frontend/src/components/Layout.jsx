import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu, MoreHorizontal, Plus, X } from 'lucide-react';
import { cerrarSesion, usuarioActual } from '../auth';
import { MENUS } from '../menus';
import Avatar from './Avatar';

const ROLES = { secretaria: 'Secretaría', medico: 'Médico', paciente: 'Paciente' };

// En el celular, las 4 secciones más usadas de cada rol van en la barra de abajo
const ABAJO = {
  secretaria: ['', 'turnos', 'pacientes', 'medicos'],
  medico: ['', 'agenda', 'pacientes', 'recetas'],
  paciente: ['', 'sacar-turno', 'mis-turnos', 'mis-recetas'],
};

function Marca() {
  return (
    <div className="lateral-marca">
      <span className="logo" aria-hidden="true"><Plus size={20} strokeWidth={2.8} /></span>
      <div>
        <strong>CAPS Turnos</strong>
        <small>Centro de salud</small>
      </div>
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = usuarioActual();
  const menu = MENUS[usuario.rol];
  const base = `/${usuario.rol}`;
  // Se guarda en qué pantalla se abrió el menú desplegable: al cambiar de pantalla queda cerrado solo
  const [abiertoEn, setAbiertoEn] = useState(null);
  const abierto = abiertoEn === location.pathname;
  const setAbierto = (si) => setAbiertoEn(si ? location.pathname : null);

  // También se cierra con la tecla Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && setAbiertoEn(null);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  const salir = () => {
    cerrarSesion();
    navigate('/login');
  };

  const ruta = (a) => (a ? `${base}/${a}` : base);
  // El resto de las secciones se abren con "Más"
  const principales = (ABAJO[usuario.rol] || []).map((a) => menu.find((o) => o.a === a)).filter(Boolean);

  return (
    <div className="app">
      <header className="barra-superior">
        <Marca />
        <button
          className="boton-menu" onClick={() => setAbierto(true)}
          aria-label="Abrir menú" aria-expanded={abierto} aria-controls="menu-lateral"
        >
          <Menu size={20} />
        </button>
      </header>

      <aside id="menu-lateral" className={`lateral${abierto ? ' abierto' : ''}`} aria-label="Menú principal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Marca />
          {abierto && (
            <button className="boton-menu" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
              <X size={20} />
            </button>
          )}
        </div>

        <nav>
          {menu.map(({ a, texto, icono: Icono }) => (
            <NavLink key={texto} to={ruta(a)} end={!a}>
              <Icono size={19} /> {texto}
            </NavLink>
          ))}
        </nav>

        <div className="lateral-usuario">
          <div className="quien">
            <Avatar nombre={usuario.nombre} apellido={usuario.apellido} tamano={40} />
            <div>
              <strong>{usuario.nombre} {usuario.apellido}</strong>
              <span>{ROLES[usuario.rol]}</span>
            </div>
          </div>
          <div className="acciones-usuario">
            <Link to="/cambiar-clave"><KeyRound size={15} /> Cambiar contraseña</Link>
            <button onClick={salir}><LogOut size={15} /> Cerrar sesión</button>
          </div>
        </div>
      </aside>
      {abierto && <div className="velo" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <main className="contenido">
        {/* La clave hace que cada pantalla nueva entre con una animación suave */}
        <div className="pagina" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      <nav className="barra-inferior" aria-label="Secciones">
        {principales.map(({ a, texto, icono: Icono }) => (
          <NavLink key={texto} to={ruta(a)} end={!a}>
            <Icono size={21} />
            <span>{texto}</span>
          </NavLink>
        ))}
        <button onClick={() => setAbierto(true)} aria-label="Más opciones" aria-expanded={abierto} aria-controls="menu-lateral">
          <MoreHorizontal size={21} />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}
