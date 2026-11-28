import { useEffect, useState } from 'react';
import { Ban, Pencil, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { diaDeSemana, formatoFecha, hoyISO } from '../fechas';
import Filtros from './Filtros';

export default function Feriados() {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('todos');
  const [cuando, setCuando] = useState('todos');
  const [feriados, setFeriados] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState('');
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = () =>
    apiFetch('/horarios/feriados')
      .then(setFeriados)
      .catch((err) => setError(mensajeDeError(err)));

  useEffect(() => {
    apiFetch('/horarios/feriados')
      .then(setFeriados)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  const cancelarEdicion = () => {
    setEditando(null);
    setFecha(hoyISO());
    setDescripcion('');
  };

  const editar = (f) => {
    setError('');
    setOk('');
    setEditando(f.id);
    setFecha(f.fecha);
    setDescripcion(f.descripcion);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      if (editando) {
        await apiFetch(`/horarios/feriados/${editando}`, { method: 'PUT', body: JSON.stringify({ fecha, descripcion }) });
        setOk('Feriado actualizado');
      } else {
        await apiFetch('/horarios/feriados', { method: 'POST', body: JSON.stringify({ fecha, descripcion }) });
        setOk('Feriado cargado');
      }
      cancelarEdicion();
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarEstado = async (f) => {
    setError('');
    setOk('');
    try {
      await apiFetch(`/horarios/feriados/${f.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !f.activo }) });
      if (editando === f.id) cancelarEdicion();
      setOk(f.activo ? 'Feriado desactivado' : 'Feriado reactivado');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const hoy = hoyISO();
  const q = texto.trim().toLowerCase();
  const visibles = feriados.filter((f) => {
    if (estado === 'vigentes' && !f.activo) return false;
    if (estado === 'desactivados' && f.activo) return false;
    if (cuando === 'proximos' && f.fecha < hoy) return false;
    if (cuando === 'pasados' && f.fecha >= hoy) return false;
    return !q || f.descripcion.toLowerCase().includes(q);
  });
  const hayFiltro = Boolean(q || estado !== 'todos' || cuando !== 'todos');

  return (
    <div className="panel">
      <h2>Feriados y días sin atención</h2>
      <p className="panel-subtitulo">
        Valen para todos los médicos: ese día el CAPS no da turnos. Los feriados trasladables cambian de fecha cada año,
        así que se cargan a mano. Podés corregirlos con <strong>Editar</strong> y pausarlos con <strong>Desactivar</strong>.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <h3>{editando ? 'Editar feriado' : 'Agregar feriado'}</h3>
      <form className="fila-form" onSubmit={guardar}>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <input
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción (ej: Navidad)" maxLength={100} required
        />
        <button className="boton" type="submit">{editando ? 'Guardar cambios' : 'Agregar'}</button>
        {editando && (
          <button className="boton secundario" type="button" onClick={cancelarEdicion}>Cancelar</button>
        )}
      </form>

      <h3 style={{ marginTop: 24 }}>Feriados cargados</h3>
      {cargado && feriados.length > 0 && (
        <Filtros clase="de-a-dos" hayFiltro={hayFiltro} onLimpiar={() => { setTexto(''); setEstado('todos'); setCuando('todos'); }}>
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por descripción" aria-label="Buscar feriado" />
          <select value={cuando} onChange={(e) => setCuando(e.target.value)} aria-label="Filtrar por fecha">
            <option value="todos">Fecha: todos</option>
            <option value="proximos">Solo próximos</option>
            <option value="pasados">Solo pasados</option>
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
            <option value="todos">Estado: todos</option>
            <option value="vigentes">Solo vigentes</option>
            <option value="desactivados">Solo desactivados</option>
          </select>
        </Filtros>
      )}
      {!cargado ? null : feriados.length === 0 ? (
        <p className="suave">No hay feriados cargados.</p>
      ) : visibles.length === 0 ? (
        <p className="suave">No hay feriados que coincidan con el filtro.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className={f.activo ? '' : 'fila-baja'}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>{formatoFecha(f.fecha)}</strong> <span className="suave">{diaDeSemana(f.fecha)}</span>
                  </td>
                  <td>{f.descripcion}</td>
                  <td><span className={`etiqueta ${f.activo ? 'activo' : 'baja'}`}>{f.activo ? 'Vigente' : 'Desactivado'}</span></td>
                  <td>
                    <div className="acciones-fila">
                      <button className="boton-chico" onClick={() => editar(f)}><Pencil size={14} /> Editar</button>
                      <button className="boton-chico" onClick={() => cambiarEstado(f)}>
                        {f.activo ? <><Ban size={14} /> Desactivar</> : <><RotateCcw size={14} /> Reactivar</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}