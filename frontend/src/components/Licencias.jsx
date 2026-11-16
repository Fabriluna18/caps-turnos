import { useEffect, useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { formatoFecha, hoyISO } from '../fechas';

export default function Licencias({ medicoId }) {
  const [licencias, setLicencias] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = () =>
    apiFetch(`/horarios/licencias?medico_id=${medicoId}`)
      .then(setLicencias)
      .catch((err) => setError(mensajeDeError(err)));

  useEffect(() => {
    apiFetch(`/horarios/licencias?medico_id=${medicoId}`)
      .then(setLicencias)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, [medicoId]);

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await apiFetch('/horarios/licencias', {
        method: 'POST',
        body: JSON.stringify({ medico_id: Number(medicoId), desde, hasta, motivo }),
      });
      setMotivo('');
      setOk('Licencia cargada');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarEstado = async (l) => {
    setError('');
    setOk('');
    try {
      await apiFetch(`/horarios/licencias/${l.id}/estado`, { method: 'PUT', body: JSON.stringify({ activa: !l.activa }) });
      setOk(l.activa ? 'Licencia cancelada' : 'Licencia reactivada');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <div className="panel">
      <h2>Licencias</h2>
      <p className="suave" style={{ marginTop: 0 }}>
        En estas fechas el médico no atiende, aunque tenga horarios cargados. Las licencias canceladas quedan guardadas.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <form onSubmit={agregar}>
        <div className="grilla-form">
          <label className="campo">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </label>
          <label className="campo">
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required />
          </label>
          <label className="campo">
            Motivo (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={100} placeholder="Ej: vacaciones" />
          </label>
        </div>
        <div className="acciones">
          <button className="boton" type="submit">Cargar licencia</button>
        </div>
      </form>

      {!cargado ? null : licencias.length === 0 ? (
        <p className="suave" style={{ marginTop: 16 }}>No hay licencias cargadas.</p>
      ) : (
        <div className="tabla-scroll" style={{ marginTop: 16 }}>
          <table className="tabla">
            <thead>
              <tr><th>Desde</th><th>Hasta</th><th>Motivo</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {licencias.map((l) => (
                <tr key={l.id} className={l.activa ? '' : 'fila-baja'}>
                  <td>{formatoFecha(l.desde)}</td>
                  <td>{formatoFecha(l.hasta)}</td>
                  <td>{l.motivo || '-'}</td>
                  <td><span className={`etiqueta ${l.activa ? 'activo' : 'baja'}`}>{l.activa ? 'Vigente' : 'Cancelada'}</span></td>
                  <td>
                    <button className="boton-chico" onClick={() => cambiarEstado(l)}>
                      {l.activa ? <><Ban size={14} /> Cancelar</> : <><RotateCcw size={14} /> Reactivar</>}
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