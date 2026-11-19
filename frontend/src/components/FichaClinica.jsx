import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, History, Pencil } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { edad } from '../fechas';

const GRUPOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
const CAMPOS = [
  { id: 'alergias', texto: 'Alergias', max: 500, filas: 2 },
  { id: 'enfermedades', texto: 'Enfermedades', max: 500, filas: 2 },
  { id: 'medicacion', texto: 'Medicación habitual', max: 500, filas: 2 },
  { id: 'antecedentes_personales', texto: 'Antecedentes personales', max: 1000, filas: 3 },
  { id: 'antecedentes_familiares', texto: 'Antecedentes familiares', max: 1000, filas: 3 },
];

const vacio = () => ({ grupo_sanguineo: '', ...Object.fromEntries(CAMPOS.map((c) => [c.id, ''])) });
// "2026-11-18 15:20:00" -> "18/11/2026 15:20"
const fechaHora = (t) => (t ? `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)} ${t.slice(11, 16)}` : '');

// Ficha clínica de un paciente, vista por el médico (ver, editar y versiones)
export default function FichaClinica({ pacienteId, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(vacio());
  const [versiones, setVersiones] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = useCallback(() => {
    apiFetch(`/medico/pacientes/${pacienteId}/ficha`)
      .then((r) => {
        setDatos(r);
        setError('');
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [pacienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const editar = () => {
    const f = datos.ficha;
    setForm(f ? Object.fromEntries(Object.keys(vacio()).map((k) => [k, f[k] ?? ''])) : vacio());
    setOk('');
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const r = await apiFetch(`/medico/pacientes/${pacienteId}/ficha`, {
        method: 'PUT',
        body: JSON.stringify({ ...form, version_id: datos.ficha?.version_id ?? null }),
      });
      setOk(r.sin_cambios ? 'No había cambios para guardar.' : 'Ficha actualizada. La versión anterior quedó guardada.');
      setEditando(false);
      setVersiones(null);
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const verVersiones = async () => {
    if (versiones) {
      setVersiones(null);
      return;
    }
    try {
      setVersiones(await apiFetch(`/medico/pacientes/${pacienteId}/ficha/versiones`));
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  if (!datos) {
    return (
      <div className="panel">
        {error ? <p className="error" role="alert">{error}</p> : <p className="suave">Cargando...</p>}
      </div>
    );
  }

  const { paciente, ficha } = datos;

  return (
    <div className="panel">
      <h2>Ficha de {paciente.apellido}, {paciente.nombre}</h2>
      <p className="suave" style={{ marginTop: 0 }}>
        DNI {paciente.dni}
        {paciente.fecha_nacimiento ? ` · ${edad(paciente.fecha_nacimiento)} años` : ''}
        {` · ${paciente.cobertura || 'Sin cobertura'}`}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {!editando && (
        <>
          {ficha?.alergias && (
            <p className="error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={16} /> <strong>Alergias:</strong> {ficha.alergias}
            </p>
          )}
          {!ficha && <p className="suave">Todavía no tiene ficha cargada.</p>}
          {ficha && (
            <dl className="datos">
              <div><dt>Grupo sanguíneo</dt><dd>{ficha.grupo_sanguineo || '—'}</dd></div>
              {CAMPOS.filter((c) => c.id !== 'alergias').map((c) => (
                <div key={c.id}><dt>{c.texto}</dt><dd style={{ whiteSpace: 'pre-line' }}>{ficha[c.id] || '—'}</dd></div>
              ))}
            </dl>
          )}
          {ficha && (
            <p className="leyenda">Última actualización: {fechaHora(ficha.actualizado_en)} por {ficha.actualizado_por}</p>
          )}
          <div className="acciones">
            <button className="boton" onClick={editar}><Pencil size={14} /> {ficha ? 'Editar ficha' : 'Cargar ficha'}</button>
            {datos.versiones > 1 && (
              <button className="boton secundario" onClick={verVersiones}>
                <History size={14} /> {versiones ? 'Ocultar cambios' : `Ver cambios (${datos.versiones} versiones)`}
              </button>
            )}
            {onCerrar && <button className="boton secundario" onClick={onCerrar}>Cerrar</button>}
          </div>
        </>
      )}

      {editando && (
        <form className="formulario" onSubmit={guardar}>
          <label className="campo">
            Grupo sanguíneo
            <select value={form.grupo_sanguineo} onChange={(e) => setForm({ ...form, grupo_sanguineo: e.target.value })}>
              <option value="">Sin dato</option>
              {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          {CAMPOS.map((c) => (
            <label key={c.id} className="campo">
              {c.texto}
              <textarea
                rows={c.filas} maxLength={c.max} value={form[c.id]}
                onChange={(e) => setForm({ ...form, [c.id]: e.target.value })}
              />
            </label>
          ))}
          <p className="leyenda">Cada vez que guardás se crea una versión nueva: la anterior no se borra.</p>
          <div className="acciones">
            <button className="boton" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar ficha'}</button>
            <button type="button" className="boton secundario" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {versiones && (
        <div style={{ marginTop: 16 }}>
          <h3>Cambios de la ficha</h3>
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Médico</th><th>Grupo</th><th>Alergias</th><th>Medicación</th></tr></thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.id}>
                  <td>{fechaHora(v.fecha)}</td>
                  <td>{v.autor}</td>
                  <td>{v.grupo_sanguineo || '—'}</td>
                  <td>{v.alergias || '—'}</td>
                  <td>{v.medicacion || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
