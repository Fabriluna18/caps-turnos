import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { diaDeSemana, formatoFecha } from '../fechas';

// Si se pasa onElegirHora, los turnos libres son botones (el Día 8 lo usa para reservar)
export default function HorariosDelDia({ medicoId, fecha, onElegirHora, version = 0 }) {
  const [resp, setResp] = useState(null);
  const [error, setError] = useState('');
  const clave = fecha ? `${medicoId}|${fecha}|${version}` : '';

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    apiFetch(`/disponibilidad/dia?medico_id=${medicoId}&fecha=${fecha}`)
      .then((r) => {
        if (!vigente) return;
        setResp({ clave, ...r });
        setError('');
      })
      .catch((err) => {
        if (vigente) setError(mensajeDeError(err));
      });
    return () => {
      vigente = false;
    };
  }, [medicoId, fecha, version, clave]);

  if (!fecha) {
    return (
      <div className="panel">
        <h2>Turnos del día</h2>
        <p className="suave">Elegí un día del calendario para ver sus turnos.</p>
      </div>
    );
  }

  const listo = resp && resp.clave === clave;

  return (
    <div className="panel">
      <h2 style={{ textTransform: 'capitalize' }}>{diaDeSemana(fecha)} {formatoFecha(fecha)}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {!listo && !error && <p className="suave">Cargando...</p>}
      {listo && resp.mensaje && <div className="aviso-dia">{resp.mensaje}</div>}
      {listo && resp.turnos.length > 0 && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>
            {resp.libres === 1 ? 'Queda 1 turno libre.' : `Quedan ${resp.libres} turnos libres.`}
          </p>
          <div className="horas">
            {resp.turnos.map((t) =>
              t.libre && onElegirHora ? (
                <button key={t.hora} type="button" className="hora libre" onClick={() => onElegirHora(t)}>
                  {t.hora}
                </button>
              ) : (
                <span key={t.hora} className={`hora ${t.libre ? 'libre' : 'ocupada'}`}>
                  {t.hora}
                </span>
              )
            )}
          </div>
          <p className="leyenda">Los horarios tachados ya están ocupados.</p>
        </>
      )}
    </div>
  );
}