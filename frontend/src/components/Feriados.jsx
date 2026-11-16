import { useEffect, useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { diaDeSemana, formatoFecha, hoyISO } from '../fechas';

export default function Feriados() {
  const [feriados, setFeriados] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState('');
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

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await apiFetch('/horarios/feriados', { method: 'POST', body: JSON.stringify({ fecha, descripcion }) });
      setDescripcion('');
      setOk('Feriado cargado');
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
      setOk(f.activo ? 'Feriado desactivado' : 'Feriado reactivado');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <div className="panel">
      <h2>Feriados y días sin atención</h2>
      <p className="suave" style={{ marginTop: 0 }}>
        Valen para todos los médicos: ese día el CAPS no da turnos. Los feriados trasladables cambian de fecha cada año,
        así que se cargan a mano. Los que se desactivan quedan guardados.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <form className="fila-form" onSubmit={agregar}>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        <input
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción (ej: Navidad)" maxLength={100} required
        />
        <button className="boton" type="submit">Agregar</button>
      </form>

      {!cargado ? null : feriados.length === 0 ? (
        <p className="suave" style={{ marginTop: 16 }}>No hay feriados cargados.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginTop: 16 }}>
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id} className={f.activo ? '' : 'fila-baja'}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>{formatoFecha(f.fecha)}</strong> <span className="suave">{diaDeSemana(f.fecha)}</span>
                  </td>
                  <td>{f.descripcion}</td>
                  <td><span className={`etiqueta ${f.activo ? 'activo' : 'baja'}`}>{f.activo ? 'Vigente' : 'Desactivado'}</span></td>
                  <td>
                    <button className="boton-chico" onClick={() => cambiarEstado(f)}>
                      {f.activo ? <><Ban size={14} /> Desactivar</> : <><RotateCcw size={14} /> Reactivar</>}
                    </button>
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