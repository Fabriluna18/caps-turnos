import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';

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
      localStorage.setItem('token', r.token);
      localStorage.setItem('usuario', JSON.stringify(r.usuario));
      navigate('/panel');
    } catch (err) {
      setError(err instanceof TypeError ? 'No pudimos conectarnos con el servidor.' : err.message);
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
      </div>
    </div>
  );
}