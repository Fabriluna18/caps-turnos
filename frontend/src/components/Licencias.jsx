import { useEffect, useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { formatoFecha, hoyISO } from '../fechas';
import Filtros from './Filtros';

// Licencias de un médico. La usan:
//  - la secretaría en Horarios (medicoId = el médico elegido)
//  - el propio médico en "Mis ausencias" (propio = true): avisa los días que no va
export default function Licencias({ medicoId, propio = false }) {
  const base = propio ? '/medico/licencias' : '/horarios/licencias';
  const listar = propio ? base : `${base}?medico_id=${medicoId}`;
  const palabra = propio ? 'ausencia' : 'licencia';

  const [licencias, setLicencias] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [motivo, setMotivo] = useState('');
  const [cuando, setCuando] = useState('todas');
  const [estado, setEstado] = useState('todas');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = () =>
    apiFetch(listar)
      .then(setLicencias)
      .catch((err) => setError(mensajeDeError(err)));

  useEffect(() => {
    apiFetch(listar)
      .then(setLicencias)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, [listar]);

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await apiFetch(base, {
        method: 'POST',
        body: JSON.stringify(propio ? { desde, hasta, motivo } : { medico_id: Number(medicoId), desde, hasta, motivo }),
      });
      setMotivo('');
      setOk(propio ? 'Ausencia cargada. Esos días no se van a dar turnos con vos.' : 'Licencia cargada');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarEstado = async (l) => {
    if (l.activa && propio && !window.confirm('¿Cancelar esta ausencia? Esos días se vuelven a dar turnos con vos.')) return;
    setError('');
    setOk('');
    try {
      await apiFetch(`${base}/${l.id}/estado`, { method: 'PUT', body: JSON.stringify({ activa: !l.activa }) });
      setOk(l.activa ? `${propio ? 'Ausencia' : 'Licencia'} cancelada` : `${propio ? 'Ausencia' : 'Licencia'} reactivada`);
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const hoy = hoyISO();
  const visibles = licencias.filter((l) => {
    if (estado === 'vigentes' && !l.activa) return false;
    if (estado === 'canceladas' && l.activa) return false;
    if (cuando === 'proximas' && l.hasta < hoy) return false;
    if (cuando === 'pasadas' && l.hasta >= hoy) return false;
    return true;
  });
  const hayFiltro = cuando !== 'todas' || estado !== 'todas';

  return (
    <div className="panel">
      <h2>{propio ? 'Avisar que no voy' : 'Licencias'}</h2>
      <p className="panel-subtitulo">
        {propio
          ? 'Cargá los días que no vas a atender (vacaciones, enfermedad, capacitación...). Esos días no se dan turnos con vos y la secretaría lo ve en Horarios.'
          : 'En estas fechas el médico no atiende, aunque tenga horarios cargados. Las licencias canceladas quedan guardadas. Las que carga el médico desde su cuenta también aparecen acá.'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <form onSubmit={agregar}>
        <div className="grilla-form">
          <label className="campo">
            Desde
            <input type="date" value={desde} min={propio ? hoy : undefined} onChange={(e) => setDesde(e.target.value)} required />
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
          <button className="boton" type="submit">{propio ? 'Cargar ausencia' : 'Cargar licencia'}</button>
        </div>
        {propio && (
          <p className="leyenda">
            Si ya tenés turnos reservados esos días, primero la secretaría tiene que reprogramarlos o cancelarlos (así nadie viene en vano).
          </p>
        )}
      </form>

      <h3 style={{ marginTop: 24 }}>{propio ? 'Mis ausencias' : 'Licencias cargadas'}</h3>
      {!cargado ? null : licencias.length === 0 ? (
        <p className="suave">No hay {palabra}s cargadas.</p>
      ) : (
        <>
          <Filtros clase="de-a-dos" hayFiltro={hayFiltro} onLimpiar={() => { setCuando('todas'); setEstado('todas'); }}>
            <select value={cuando} onChange={(e) => setCuando(e.target.value)} aria-label="Filtrar por fecha">
              <option value="todas">Fecha: todas</option>
              <option value="proximas">Solo próximas o en curso</option>
              <option value="pasadas">Solo pasadas</option>
            </select>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="todas">Estado: todas</option>
              <option value="vigentes">Solo vigentes</option>
              <option value="canceladas">Solo canceladas</option>
            </select>
          </Filtros>
          {visibles.length === 0 ? (
            <p className="suave">No hay {palabra}s que coincidan con el filtro.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Desde</th><th>Hasta</th><th>Motivo</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.id} className={l.activa ? '' : 'fila-baja'}>
                      <td>{formatoFecha(l.desde)}</td>
                      <td>{formatoFecha(l.hasta)}</td>
                      <td>{l.motivo || '-'}</td>
                      <td><span className={`etiqueta ${l.activa ? 'activo' : 'baja'}`}>{l.activa ? 'Vigente' : 'Cancelada'}</span></td>
                      <td>
                        {/* El médico no toca las que ya pasaron */}
                        {(!propio || l.hasta >= hoy) && (
                          <button className="boton-chico" onClick={() => cambiarEstado(l)}>
                            {l.activa ? <><Ban size={14} /> Cancelar</> : <><RotateCcw size={14} /> Reactivar</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
