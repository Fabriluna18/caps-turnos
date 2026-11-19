import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { ESTADOS } from '../estados';
import { edad, formatoFecha } from '../fechas';

// Lo que el paciente de un turno tuvo con ESTE médico: consultas anteriores y recetas
export default function HistorialPaciente({ turnoId, onCerrar }) {
  const [h, setH] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/medico/turnos/${turnoId}/historial`)
      .then(setH)
      .catch((err) => setError(mensajeDeError(err)));
  }, [turnoId]);

  return (
    <div className="panel">
      {error && <p className="error" role="alert">{error}</p>}
      {!h && !error && <p className="suave">Cargando...</p>}
      {h && (
        <>
          <h2>Historial de {h.paciente.apellido}, {h.paciente.nombre}</h2>
          <p className="suave" style={{ marginTop: 0 }}>
            DNI {h.paciente.dni}
            {h.paciente.fecha_nacimiento ? ` · ${edad(h.paciente.fecha_nacimiento)} años` : ''}
            {` · ${h.paciente.cobertura || 'Sin cobertura'}`}
            {` · ${h.resumen.atendidas} consulta${h.resumen.atendidas === 1 ? '' : 's'} con vos`}
            {h.resumen.ausencias ? ` · ${h.resumen.ausencias} ausencia${h.resumen.ausencias === 1 ? '' : 's'}` : ''}
          </p>

          <h3>Consultas anteriores</h3>
          {h.consultas.length === 0 ? (
            <p className="suave">Es la primera vez que te consulta.</p>
          ) : (
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {h.consultas.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{formatoFecha(c.fecha)}</strong> <span className="suave">{c.hora}</span></td>
                    <td>{c.motivo || <span className="suave">—</span>}{c.diagnostico && <div><strong>Dx:</strong> {c.diagnostico}</div>}{c.recetas > 0 && <div className="suave">Con receta</div>}</td>
                    <td><span className={`estado ${c.estado}`}>{ESTADOS[c.estado]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Recetas que le hiciste</h3>
          {h.recetas.length === 0 ? (
            <p className="suave">Ninguna todavía.</p>
          ) : (
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Medicamentos</th><th /></tr></thead>
              <tbody>
                {h.recetas.map((r) => (
                  <tr key={r.id} style={r.anulada ? { opacity: 0.6 } : undefined}>
                    <td><strong>{formatoFecha(r.fecha)}</strong></td>
                    <td>
                      {r.medicamentos}
                      {r.diagnostico && <div className="suave">{r.diagnostico}</div>}
                      {r.anulada && <div><span className="estado cancelado">Anulada</span></div>}
                    </td>
                    <td><a className="boton-chico" href={`/receta/${r.id}`} target="_blank" rel="noopener noreferrer">Ver</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      <div className="acciones">
        <button className="boton secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}
