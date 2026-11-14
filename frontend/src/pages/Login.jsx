import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { guardarSesion, rutaInicio } from '../auth';

export default function Login() {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ dni, password }) });
      guardarSesion(r.token, r.usuario);
      navigate(rutaInicio(r.usuario));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>CAPS Turnos</h1>
        <p className="suave">Ingresá con tu DNI y tu contraseña.</p>
        <form className="formulario" onSubmit={entrar}>
          <label className="campo">
            DNI
            <input
              value={dni} onChange={(e) => setDni(e.target.value)}
              inputMode="numeric" autoComplete="username" maxLength={10} placeholder="Ej: 12345678" required
            />
          </label>
          <label className="campo">
            Contraseña
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Ingresar'}
          </button>
        </form>
        <p className="pie-tarjeta"><Link className="enlace" to="/olvide">¿Olvidaste tu contraseña?</Link></p>
      </div>
    </div>
  );
}