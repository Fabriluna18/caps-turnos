import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

export default function Olvide() {
  const [por, setPor] = useState('dni');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const elegir = (opcion) => {
    setPor(opcion);
    setValor('');
    setError('');
    setMensaje('');
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      const cuerpo = por === 'dni' ? { dni: valor } : { email: valor };
      const r = await apiFetch('/auth/olvide', { method: 'POST', body: JSON.stringify(cuerpo) });
      setMensaje(r.mensaje);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>Recuperar contraseña</h1>
        <p className="suave">Te enviamos un enlace al email que tengas registrado.</p>

        <div className="pestanas">
          <button type="button" className={por === 'dni' ? 'activa' : ''} onClick={() => elegir('dni')}>Por DNI</button>
          <button type="button" className={por === 'email' ? 'activa' : ''} onClick={() => elegir('email')}>Por email</button>
        </div>

        <form className="formulario" onSubmit={enviar}>
          <label className="campo">
            {por === 'dni' ? 'DNI' : 'Email'}
            <input
              key={por}
              type={por === 'dni' ? 'text' : 'email'}
              inputMode={por === 'dni' ? 'numeric' : 'email'}
              value={valor} onChange={(e) => setValor(e.target.value)}
              maxLength={por === 'dni' ? 10 : 150}
              placeholder={por === 'dni' ? 'Ej: 12345678' : 'tu@email.com'}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {mensaje && <p className="exito" role="status">{mensaje}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
        <p className="pie-tarjeta"><Link className="enlace" to="/login">Volver al ingreso</Link></p>
      </div>
    </div>
  );
}