import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { edad, formatoFecha } from '../fechas';

const ROLES = { secretaria: 'Secretaría', medico: 'Médico', paciente: 'Paciente' };

const aFormulario = (p) => ({
  telefono: p.telefono || '',
  email: p.email || '',
  direccion: p.direccion || '',
  localidad: p.localidad || '',
});

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState(null);
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    apiFetch('/perfil')
      .then((p) => {
        setPerfil(p);
        setForm(aFormulario(p));
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  if (!perfil || !form) {
    return (
      <>
        <h1>Mi perfil</h1>
        {error ? <p className="error" role="alert">{error}</p> : <p className="suave">Cargando...</p>}
      </>
    );
  }

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const cambiaEmail = form.email.trim().toLowerCase() !== (perfil.email || '');
  const esPaciente = perfil.rol === 'paciente';

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setGuardando(true);
    try {
      const r = await apiFetch('/perfil', {
        method: 'PUT',
        body: JSON.stringify({ ...form, ...(cambiaEmail ? { password_actual: password } : {}) }),
      });
      setPerfil(r.perfil);
      setForm(aFormulario(r.perfil));
      setPassword('');
      // Se actualiza el email guardado en la sesión (lo usa el aviso del inicio)
      const sesion = JSON.parse(localStorage.getItem('usuario') || '{}');
      localStorage.setItem('usuario', JSON.stringify({ ...sesion, email: r.perfil.email }));
      setOk('Datos actualizados');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <h1>Mi perfil</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <div className="panel">
        <h2>Mis datos</h2>
        <dl className="datos">
          <div><dt>Nombre</dt><dd>{perfil.apellido}, {perfil.nombre}</dd></div>
          <div><dt>DNI</dt><dd>{perfil.dni}</dd></div>
          <div><dt>Rol</dt><dd>{ROLES[perfil.rol]}</dd></div>
          {perfil.fecha_nacimiento && (
            <div>
              <dt>Fecha de nacimiento</dt>
              <dd>{formatoFecha(perfil.fecha_nacimiento)} ({edad(perfil.fecha_nacimiento)} años)</dd>
            </div>
          )}
          {perfil.cobertura && <div><dt>Cobertura</dt><dd>{perfil.cobertura}</dd></div>}
          {perfil.especialidad && <div><dt>Especialidad</dt><dd>{perfil.especialidad}</dd></div>}
          {perfil.matricula && <div><dt>Matrícula</dt><dd>{perfil.matricula}</dd></div>}
        </dl>
        <p className="suave" style={{ marginBottom: 0 }}>
          Si algún dato de este cuadro está mal, pedile a la secretaría que lo corrija.
        </p>
      </div>

      <div className="panel">
        <h2>Datos de contacto</h2>
        <form onSubmit={guardar}>
          <div className="grilla-form">
            <label className="campo">
              Teléfono
              <input name="telefono" value={form.telefono} onChange={cambiar} maxLength={30} />
            </label>
            <label className="campo">
              Email
              <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} />
            </label>
            {esPaciente && (
              <>
                <label className="campo">
                  Dirección
                  <input name="direccion" value={form.direccion} onChange={cambiar} maxLength={150} />
                </label>
                <label className="campo">
                  Localidad
                  <input name="localidad" value={form.localidad} onChange={cambiar} maxLength={80} />
                </label>
              </>
            )}
          </div>

          {cambiaEmail && (
            <div className="aviso-dia" style={{ marginBottom: 12 }}>
              <strong>Estás cambiando el email.</strong> Es el que se usa para recuperar tu contraseña, así que te pedimos
              tu contraseña actual para confirmar que sos vos.
              <label className="campo" style={{ marginTop: 10 }}>
                Contraseña actual
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required
                />
              </label>
            </div>
          )}

          <div className="acciones">
            <button className="boton" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}