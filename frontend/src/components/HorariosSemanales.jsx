import { useEffect, useState } from 'react';
import { Ban, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DURACIONES = [10, 15, 20, 30, 40, 45, 60];

export default function HorariosSemanales({ medicoId }) {
  const [horarios, setHorarios] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [dias, setDias] = useState([1, 2, 3, 4, 5]);
  const [diaEdicion, setDiaEdicion] = useState(1);
  const [inicio, setInicio] = useState('08:00');
  const [fin, setFin] = useState('12:00');
  const [duracion, setDuracion] = useState('30');
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = () =>
    apiFetch(`/horarios?medico_id=${medicoId}`)
      .then(setHorarios)
      .catch((err) => setError(mensajeDeError(err)));

  useEffect(() => {
    apiFetch(`/horarios?medico_id=${medicoId}`)
      .then(setHorarios)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, [medicoId]);

  const alternarDia = (d) =>
    setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort());

  const terminarEdicion = () => {
    setEditando(null);
    setInicio('08:00');
    setFin('12:00');
    setDuracion('30');
  };

  const editar = (h) => {
    setError('');
    setOk('');
    setEditando(h.id);
    setDiaEdicion(h.dia_semana);
    setInicio(h.hora_inicio);
    setFin(h.hora_fin);
    setDuracion(String(h.duracion_min));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (!editando && dias.length === 0) {
      setError('Elegí al menos un día');
      return;
    }
    setGuardando(true);
    try {
      const comun = { hora_inicio: inicio, hora_fin: fin, duracion_min: Number(duracion) };
      if (editando) {
        await apiFetch(`/horarios/${editando}`, {
          method: 'PUT',
          body: JSON.stringify({ ...comun, dia_semana: diaEdicion }),
        });
        setOk('Horario actualizado');
        terminarEdicion();
      } else {
        const r = await apiFetch('/horarios', {
          method: 'POST',
          body: JSON.stringify({ ...comun, medico_id: Number(medicoId), dias }),
        });
        setOk(r.creados === 1 ? 'Horario agregado' : `${r.creados} horarios agregados`);
      }
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (h) => {
    setError('');
    setOk('');
    try {
      await apiFetch(`/horarios/${h.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !h.activo }) });
      if (editando === h.id) terminarEdicion();
      setOk(h.activo ? 'Horario desactivado' : 'Horario reactivado');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const eliminar = async (h) => {
    const dia = DIAS[h.dia_semana - 1].toLowerCase();
    if (!window.confirm(`¿Eliminar el horario del ${dia} de ${h.hora_inicio} a ${h.hora_fin}? Sale de la lista y deja de dar turnos, pero queda guardado en la base como historial.`)) return;
    setError('');
    setOk('');
    try {
      await apiFetch(`/horarios/${h.id}`, { method: 'DELETE' });
      if (editando === h.id) terminarEdicion();
      setOk('Horario eliminado de la lista (queda guardado en el historial)');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };


  const total = horarios.filter((h) => h.activo).reduce((suma, h) => suma + h.turnos, 0);

  return (
    <div className="panel">
      <h2>Horarios semanales</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <form onSubmit={guardar}>
        {editando ? (
          <label className="campo" style={{ maxWidth: 240, marginBottom: 12 }}>
            Día
            <select value={diaEdicion} onChange={(e) => setDiaEdicion(Number(e.target.value))}>
              {DIAS.map((nombre, i) => (
                <option key={nombre} value={i + 1}>{nombre}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="campo" style={{ marginBottom: 12 }}>
            Días
            <div className="dias-semana">
              {DIAS.map((nombre, i) => (
                <label key={nombre} className={dias.includes(i + 1) ? 'marcado' : ''}>
                  <input type="checkbox" checked={dias.includes(i + 1)} onChange={() => alternarDia(i + 1)} />
                  {nombre.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grilla-form">
          <label className="campo">
            Desde
            <input type="time" step="300" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </label>
          <label className="campo">
            Hasta
            <input type="time" step="300" value={fin} onChange={(e) => setFin(e.target.value)} required />
          </label>
          <label className="campo">
            Cada cuánto
            <select value={duracion} onChange={(e) => setDuracion(e.target.value)}>
              {DURACIONES.map((d) => (
                <option key={d} value={d}>{d} minutos</option>
              ))}
            </select>
          </label>
        </div>

        <div className="acciones">
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar horario'}
          </button>
          {editando && (
            <button className="boton secundario" type="button" onClick={terminarEdicion}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="info">
        <strong>Cómo se calculan los turnos</strong>
        La cantidad de turnos sale del intervalo. Por ejemplo, de 08:00 a 12:00 cada 30 minutos son 8 turnos.
        Para atender mañana y tarde, cargá dos bloques. Los horarios no se borran: se desactivan y quedan guardados.
      </div>

      <h3 style={{ margin: '20px 0 8px' }}>Horarios cargados</h3>
      {!cargado ? (
        <p className="suave">Cargando...</p>
      ) : horarios.length === 0 ? (
        <p className="suave">Este médico todavía no tiene horarios cargados.</p>
      ) : (
        <>
          <p className="resumen-semana">Turnos por semana (solo los vigentes): <strong>{total}</strong></p>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Día</th><th>Horario</th><th>Cada cuánto</th><th>Turnos</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {horarios.map((h) => (
                  <tr key={h.id} className={h.activo ? '' : 'fila-baja'}>
                    <td><strong>{DIAS[h.dia_semana - 1]}</strong></td>
                    <td>{h.hora_inicio} a {h.hora_fin}</td>
                    <td>{h.duracion_min} min</td>
                    <td>{h.turnos}</td>
                    <td><span className={`etiqueta ${h.activo ? 'activo' : 'baja'}`}>{h.activo ? 'Vigente' : 'Desactivado'}</span></td>
                    <td>
                      <div className="acciones-fila">
                        {h.activo && (
                          <button className="boton-chico" onClick={() => editar(h)}><Pencil size={14} /> Editar</button>
                        )}
                        <button className="boton-chico" onClick={() => cambiarEstado(h)}>
                          {h.activo ? <><Ban size={14} /> Desactivar</> : <><RotateCcw size={14} /> Reactivar</>}
                        </button>
                        <button className="boton-chico peligro" onClick={() => eliminar(h)}>
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}