import { useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { formatoFecha } from '../fechas';
import CalendarioDisponibilidad from './CalendarioDisponibilidad';
import HorariosDelDia from './HorariosDelDia';

export default function Reprogramar({ turno, onCerrar, onHecho }) {
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    setError('');
    setGuardando(true);
    try {
      await apiFetch(`/turnos/${turno.id}/reprogramar`, { method: 'PUT', body: JSON.stringify({ fecha, hora }) });
      onHecho(`Turno reprogramado para el ${formatoFecha(fecha)} a las ${hora}. Quedó pendiente de confirmación.`);
    } catch (err) {
      setError(mensajeDeError(err));
      setHora(null);
      setVersion((v) => v + 1);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="panel reprogramar">
      <div className="ficha-cab">
        <h2>Reprogramar turno</h2>
        <button className="boton-chico" onClick={onCerrar}>Cerrar</button>
      </div>
      <p className="suave" style={{ marginTop: 0 }}>
        {turno.paciente.apellido}, {turno.paciente.nombre} con {turno.medico.apellido}. Hoy lo tiene el{' '}
        {formatoFecha(turno.fecha)} a las {turno.hora}. Elegí el día y el horario nuevos.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="dos-columnas">
        <CalendarioDisponibilidad
          medicoId={turno.medico.id} fechaElegida={fecha}
          onElegir={(f) => { setFecha(f); setHora(null); }} soloConTurnos version={version}
        />
        <HorariosDelDia
          medicoId={turno.medico.id} fecha={fecha} onElegirHora={(t) => setHora(t.hora)}
          horaElegida={hora} version={version}
        />
      </div>

      {fecha && hora && (
        <div className="acciones">
          <button className="boton" onClick={confirmar} disabled={guardando}>
            {guardando ? 'Guardando...' : `Mover al ${formatoFecha(fecha)} a las ${hora}`}
          </button>
        </div>
      )}
    </div>
  );
}