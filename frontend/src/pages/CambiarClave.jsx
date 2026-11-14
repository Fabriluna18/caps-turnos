import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';

export default function CambiarClave() {
  const navigate = useNavigate();
  const usuario = usuarioActual();
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (!localStorage.getItem('token') || !usuario) return <Navigate to="/login" replace />;

  const obligatorio = usuario.debe_cambiar_clave;
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (form.nueva !== form.repetir) {
      setError('Las dos contraseñas nuevas no coinciden');
      return;
    }
    setCargando(true);
    try {
      const r = await apiFetch('/auth/cambiar-clave', {
        method: 'POST',
        body: JSON.stringify({ actual: form.actual, nueva: form.nueva }),
      });
      localStorage.setItem('usuario', JSON.stringify(r.usuario));
      navigate(`/${r.usuario.rol}`);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>Cambiar contraseña</h1>
        <p className="suave">
          {obligatorio
            ? 'Estás usando una clave temporal. Elegí una contraseña propia para continuar.'
            : 'Ingresá tu contraseña actual y elegí una nueva.'}
        </p>
        <form className="formulario" onSubmit={enviar}>
          <label className="campo">
            {obligatorio ? 'Clave temporal' : 'Contraseña actual'}
            <input
              name="actual" type="password" value={form.actual} onChange={cambiar}
              autoComplete="current-password" required
            />
          </label>
          <label className="campo">
            Contraseña nueva (mínimo 8)
            <input
              name="nueva" type="password" value={form.nueva} onChange={cambiar}
              autoComplete="new-password" minLength={8} maxLength={72} required
            />
          </label>
          <label className="campo">
            Repetí la contraseña nueva
            <input
              name="repetir" type="password" value={form.repetir} onChange={cambiar}
              autoComplete="new-password" minLength={8} maxLength={72} required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
        {!obligatorio && (
          <p className="pie-tarjeta"><Link className="enlace" to={`/${usuario.rol}`}>Volver</Link></p>
        )}
      </div>
    </div>
  );
}