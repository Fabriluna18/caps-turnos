import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

export default function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', repetir: '' });
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');
  const [cargando, setCargando] = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.repetir) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setCargando(true);
    try {
      const r = await apiFetch('/auth/restablecer', {
        method: 'POST',
        body: JSON.stringify({ token, password: form.password }),
      });
      setListo(r.mensaje);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  if (!token) {
    return (
      <div className="centrado">
        <div className="tarjeta">
          <h1>Enlace incompleto</h1>
          <p className="suave">Abrí el enlace completo que te llegó por mail, o pedí uno nuevo.</p>
          <p className="pie-tarjeta"><Link className="enlace" to="/olvide">Pedir un enlace nuevo</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>Contraseña nueva</h1>
        {listo ? (
          <>
            <p className="exito" role="status">{listo}</p>
            <p className="pie-tarjeta"><Link className="enlace" to="/login">Ir al ingreso</Link></p>
          </>
        ) : (
          <>
            <p className="suave">Elegí una contraseña de al menos 8 caracteres.</p>
            <form className="formulario" onSubmit={enviar}>
              <label className="campo">
                Contraseña nueva
                <input
                  name="password" type="password" value={form.password} onChange={cambiar}
                  autoComplete="new-password" minLength={8} maxLength={72} required
                />
              </label>
              <label className="campo">
                Repetí la contraseña
                <input
                  name="repetir" type="password" value={form.repetir} onChange={cambiar}
                  autoComplete="new-password" minLength={8} maxLength={72} required
                />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="boton" type="submit" disabled={cargando}>
                {cargando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
            <p className="pie-tarjeta"><Link className="enlace" to="/olvide">Pedir un enlace nuevo</Link></p>
          </>
        )}
      </div>
    </div>
  );
}