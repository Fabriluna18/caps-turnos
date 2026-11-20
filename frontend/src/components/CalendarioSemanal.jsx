import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { formatoFecha, hoyISO, sumarDias } from '../fechas';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TEXTO_ESTADO = { feriado: 'Feriado', licencia: 'Licencia', no_atiende: '—' };

// Semana de lunes a domingo: cuántos turnos tiene cada médico por día y cuántos quedan libres
export default function CalendarioSemanal() {
  const [desde, setDesde] = useState(hoyISO());
  const [especialidad, setEspecialidad] = useState('');
  const [especialidades, setEspecialidades] = useState([]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/especialidades').then(setEspecialidades).catch(() => {});
  }, []);

  const cargar = useCallback(() => {
    const params = new URLSearchParams({ desde });
    if (especialidad) params.set('especialidad_id', especialidad);
    apiFetch(`/secretaria/semana?${params}`)
      .then((r) => {
        setDatos(r);
        setError('');
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [desde, especialidad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const celda = (d) => {
    if (d.estado !== 'atiende') {
      return (
        <td key={d.fecha} style={{ textAlign: 'center', background: 'var(--color-fondo, #f4f6fb)', color: 'var(--color-texto-suave, #64748b)', fontSize: 12 }}>
          {d.turnos > 0 ? `${d.turnos} turnos · ` : ''}{TEXTO_ESTADO[d.estado]}
        </td>
      );
    }
    return (
      <td key={d.fecha} style={{ textAlign: 'center' }} title={`${d.turnos} turnos: ${d.atendidos} atendidos, ${d.confirmados} confirmados, ${d.sin_confirmar} sin confirmar`}>
        <strong>{d.turnos}</strong> <span className="suave" style={{ fontSize: 12 }}>turno{d.turnos === 1 ? '' : 's'}</span>
        {d.libres !== null && (
          <div style={{ fontSize: 12, color: d.libres === 0 ? 'var(--color-baja, #991b1b)' : 'var(--color-ok, #166534)' }}>
            {d.libres === 0 ? 'Completo' : `${d.libres} libre${d.libres === 1 ? '' : 's'}`}
          </div>
        )}
        {d.sin_confirmar > 0 && <div className="suave" style={{ fontSize: 12 }}>{d.sin_confirmar} sin confirmar</div>}
      </td>
    );
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          Semana{datos ? ` del ${formatoFecha(datos.desde)} al ${formatoFecha(datos.hasta)}` : ''}
        </h2>
        <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} aria-label="Especialidad">
          <option value="">Todas las especialidades</option>
          {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <button className="boton-chico" onClick={() => setDesde(sumarDias(datos?.desde ?? desde, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <button className="boton-chico secundario" onClick={() => setDesde(hoyISO())}>Esta semana</button>
        <button className="boton-chico" onClick={() => setDesde(sumarDias(datos?.desde ?? desde, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!datos && !error && <p className="suave">Cargando...</p>}
      {datos && datos.medicos.length === 0 && <p className="suave">No hay médicos activos{especialidad ? ' en esa especialidad' : ''}.</p>}
      {datos && datos.medicos.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="tabla grilla" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Médico</th>
                {datos.dias.map((d, i) => (
                  <th
                    key={d.fecha}
                    style={{ textAlign: 'center', ...(d.es_hoy ? { color: 'var(--color-primario, #1d4ed8)' } : {}) }}
                    title={d.feriado || undefined}
                  >
                    {DIAS[i]} {d.fecha.slice(8, 10)}{d.es_hoy ? ' · hoy' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.medicos.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.apellido}, {m.nombre}</strong><div className="suave" style={{ fontSize: 12 }}>{m.especialidad}</div></td>
                  {m.dias.map(celda)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="leyenda">
        Cada casilla muestra los turnos reservados y cuántos horarios quedan libres. "—" es un día en que el médico no atiende.
        <span className="solo-compu">Pasá el mouse para ver el detalle.</span>
      </p>
    </div>
  );
}
