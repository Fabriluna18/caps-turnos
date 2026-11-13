import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';

const ROLES = { secretaria: 'Secretaría', medico: 'Médico', paciente: 'Paciente' };

export default function Panel() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [usuario, setUsuario] = useState(JSON.parse(localStorage.getItem('usuario') || 'null'));
  const [prueba, setPrueba] = useState('');

  // Confirma con el servidor que la sesión sigue valiendo
  useEffect(() => {
    if (!token) return;
    apiFetch('/auth/me')
      .then((u) => {
        setUsuario(u);
        localStorage.setItem('usuario', JSON.stringify(u));
      })
      .catch(() => {});
  }, [token]);

  if (!token || !usuario) return <Navigate to="/login" />;

  const probarPermiso = async () => {
    try {
      const r = await apiFetch('/auth/prueba-secretaria');
      setPrueba(r.mensaje);
    } catch (err) {
      setPrueba(err.message);
    }
  };

  const salir = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>Hola, {usuario.nombre}</h1>
        <p className="suave">Ingresaste como {ROLES[usuario.rol]}.</p>
        <div className="acciones">
          <button className="boton secundario" onClick={probarPermiso}>Probar permiso de secretaría</button>
          <button className="boton secundario" onClick={salir}>Cerrar sesión</button>
        </div>
        {prueba && <p className="suave" style={{ marginTop: 16 }}>{prueba}</p>}
      </div>
    </div>
  );
}