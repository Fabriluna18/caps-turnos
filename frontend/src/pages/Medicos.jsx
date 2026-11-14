import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Especialidades from '../components/Especialidades';

const VACIO = { dni: '', nombre: '', apellido: '', email: '', telefono: '', matricula: '', especialidad_id: '' };

export default function Medicos() {
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [clave, setClave] = useState(null);
  const [copiada, setCopiada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = async () => {
    try {
      const [m, e] = await Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')]);
      setMedicos(m);
      setEspecialidades(e);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  useEffect(() => {
    Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e);
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const limpiarMensajes = () => {
    setError('');
    setOk('');
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm(VACIO);
  };

  const editar = (m) => {
    limpiarMensajes();
    setClave(null);
    setEditando(m.id);
    setForm({
      dni: m.dni,
      nombre: m.nombre,
      apellido: m.apellido,
      email: m.email || '',
      telefono: m.telefono || '',
      matricula: m.matricula,
      especialidad_id: String(m.especialidad_id),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardar = async (e) => {
    e.preventDefault();
    limpiarMensajes();
    setClave(null);
    setCargando(true);
    try {
      if (editando) {
        await apiFetch(`/medicos/${editando}`, { method: 'PUT', body: JSON.stringify(form) });
        setOk('Datos actualizados');
      } else {
        const r = await apiFetch('/medicos', { method: 'POST', body: JSON.stringify(form) });
        setClave({ nombre: `${r.medico.nombre} ${r.medico.apellido}`, valor: r.clave_temporal });
        setCopiada(false);
      }
      cancelarEdicion();
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (m) => {
    limpiarMensajes();
    try {
      await apiFetch(`/medicos/${m.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !m.activo }) });
      setOk(`${m.nombre} ${m.apellido} ${m.activo ? 'quedó dado de baja' : 'fue reactivado'}`);
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const nuevaClave = async (m) => {
    if (!window.confirm(`¿Generar una clave temporal nueva para ${m.nombre} ${m.apellido}? La anterior deja de funcionar.`)) return;
    limpiarMensajes();
    try {
      const r = await apiFetch(`/medicos/${m.id}/reset-clave`, { method: 'POST' });
      setClave({ nombre: `${m.nombre} ${m.apellido}`, valor: r.clave_temporal });
      setCopiada(false);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const eliminar = async (m) => {
    if (!window.confirm(`¿Eliminar a ${m.nombre} ${m.apellido}? Esta acción no se puede deshacer.`)) return;
    limpiarMensajes();
    try {
      await apiFetch(`/medicos/${m.id}`, { method: 'DELETE' });
      setOk(`${m.nombre} ${m.apellido} fue eliminado`);
      if (editando === m.id) cancelarEdicion();
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave.valor);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setError('No se pudo copiar. Seleccioná la clave y copiala a mano.');
    }
  };

  return (
    <>
      <h1>Médicos</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {clave && (
        <div className="clave-temporal" role="status">
          <strong>Clave temporal de {clave.nombre}</strong>
          <code>{clave.valor}</code>
          <p className="suave">
            Anotala y entregásela en persona: no se vuelve a mostrar. La va a tener que cambiar en su primer ingreso.
          </p>
          <div className="acciones">
            <button className="boton secundario" onClick={copiar}>{copiada ? 'Copiada ✓' : 'Copiar'}</button>
            <button className="boton secundario" onClick={() => setClave(null)}>Listo</button>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>{editando ? 'Editar médico' : 'Nuevo médico'}</h2>
        <form onSubmit={guardar}>
          <div className="grilla-form">
            <label className="campo">
              DNI
              <input
                name="dni" value={form.dni} onChange={cambiar} inputMode="numeric"
                maxLength={10} disabled={Boolean(editando)} required
              />
            </label>
            <label className="campo">
              Nombre
              <input name="nombre" value={form.nombre} onChange={cambiar} maxLength={80} required />
            </label>
            <label className="campo">
              Apellido
              <input name="apellido" value={form.apellido} onChange={cambiar} maxLength={80} required />
            </label>
            <label className="campo">
              Matrícula
              <input name="matricula" value={form.matricula} onChange={cambiar} maxLength={20} required />
            </label>
            <label className="campo">
              Especialidad
              <select name="especialidad_id" value={form.especialidad_id} onChange={cambiar} required>
                <option value="">Elegí una...</option>
                {especialidades.map((esp) => (
                  <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              Email (opcional)
              <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} />
            </label>
            <label className="campo">
              Teléfono (opcional)
              <input name="telefono" value={form.telefono} onChange={cambiar} maxLength={30} />
            </label>
          </div>
          <div className="acciones">
            <button className="boton" type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar médico'}
            </button>
            {editando && (
              <button className="boton secundario" type="button" onClick={cancelarEdicion}>Cancelar</button>
            )}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Equipo médico ({medicos.length})</h2>
        {medicos.length === 0 ? (
          <p className="suave">Todavía no cargaste médicos.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Médico</th><th>Especialidad</th><th>Matrícula</th><th>Contacto</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {medicos.map((m) => (
                  <tr key={m.id} className={m.activo ? '' : 'fila-baja'}>
                    <td><strong>{m.apellido}, {m.nombre}</strong><div className="suave">DNI {m.dni}</div></td>
                    <td>{m.especialidad}</td>
                    <td>{m.matricula}</td>
                    <td>{m.email || '-'}<div className="suave">{m.telefono || ''}</div></td>
                    <td><span className={`etiqueta ${m.activo ? 'activo' : 'baja'}`}>{m.activo ? 'Activo' : 'De baja'}</span></td>
                    <td>
                      <div className="acciones-fila">
                        <button className="boton-chico" onClick={() => editar(m)}><Pencil size={14} /> Editar</button>
                        <button className="boton-chico" onClick={() => cambiarEstado(m)}>
                          {m.activo ? <><UserX size={14} /> Dar de baja</> : <><UserCheck size={14} /> Reactivar</>}
                        </button>
                        <button className="boton-chico" onClick={() => nuevaClave(m)}><KeyRound size={14} /> Nueva clave</button>
                        <button className="boton-chico peligro" onClick={() => eliminar(m)}><Trash2 size={14} /> Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Especialidades lista={especialidades} onCambio={recargar} />
    </>
  );
}