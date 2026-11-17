import { useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { diaDeSemana, formatoFecha } from '../fechas';
import BuscadorMedico from './BuscadorMedico';
import BuscadorPaciente from './BuscadorPaciente';
import CalendarioDisponibilidad from './CalendarioDisponibilidad';
import HorariosDelDia from './HorariosDelDia';

export default function SacarTurno({ medicos, especialidades }) {
  const [paciente, setPaciente] = useState(null);
  const [medico, setMedico] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const elegirMedico = (m) => {
    setMedico(m);
    setFecha(null);
    setHora(null);
  };

  const elegirFecha = (f) => {
    setFecha(f);
    setHora(null);
  };

  const reservar = async () => {
    setError('');
    setOk('');
    setGuardando(true);
    try {
      const r = await apiFetch('/turnos', {
        method: 'POST',
        body: JSON.stringify({
          paciente_id: paciente.id,
          medico_id: medico.id,
          fecha,
          hora,
          motivo,
          confirmado,
        }),
      });
      const estado = r.turno.estado === 'confirmado' ? 'confirmado' : 'pendiente de confirmación';
      setOk(
        `Turno reservado para ${paciente.apellido}, ${paciente.nombre}: ${formatoFecha(fecha)} a las ${hora} con ${medico.apellido}. Estado: ${estado}. Lo ves en "Turnos reservados" (tocá Buscar).`
      );
      setPaciente(null);
      setHora(null);
      setMotivo('');
      setConfirmado(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(mensajeDeError(err));
      setHora(null);
      setVersion((v) => v + 1);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <div className="panel">
        <h2>1. Paciente</h2>
        {paciente ? (
          <div className="seleccion">
            <div>
              <strong>{paciente.apellido}, {paciente.nombre}</strong>
              <div className="suave">DNI {paciente.dni}</div>
            </div>
            <button className="boton-chico" onClick={() => setPaciente(null)}>Cambiar</button>
          </div>
        ) : (
          <BuscadorPaciente onElegir={setPaciente} />
        )}
      </div>

      <div className="panel">
        <h2>2. Médico</h2>
        {medico ? (
          <div className="seleccion">
            <div>
              <strong>{medico.apellido}, {medico.nombre}</strong>
              <div className="suave">{medico.especialidad}</div>
            </div>
            <button className="boton-chico" onClick={() => setMedico(null)}>Cambiar</button>
          </div>
        ) : (
          <BuscadorMedico medicos={medicos} especialidades={especialidades} onElegir={elegirMedico} />
        )}
      </div>

      {medico && (
        <>
          {medico.dias.length === 0 && (
            <p className="suave">Este médico todavía no tiene horarios cargados. Cargalos en la sección Horarios.</p>
          )}
          <div className="dos-columnas">
            <CalendarioDisponibilidad
              medicoId={medico.id} fechaElegida={fecha} onElegir={elegirFecha} soloConTurnos version={version}
            />
            <HorariosDelDia
              medicoId={medico.id} fecha={fecha} onElegirHora={(t) => setHora(t.hora)}
              horaElegida={hora} version={version}
            />
          </div>
        </>
      )}

      {medico && fecha && hora && !paciente && (
        <p className="suave">Elegí el paciente (paso 1) para poder confirmar el turno.</p>
      )}

      {paciente && medico && fecha && hora && (
        <div className="panel">
          <h2>3. Confirmar</h2>
          <dl className="datos">
            <div><dt>Paciente</dt><dd>{paciente.apellido}, {paciente.nombre}</dd></div>
            <div><dt>Médico</dt><dd>{medico.apellido}, {medico.nombre} ({medico.especialidad})</dd></div>
            <div><dt>Día</dt><dd style={{ textTransform: 'capitalize' }}>{diaDeSemana(fecha)} {formatoFecha(fecha)}</dd></div>
            <div><dt>Hora</dt><dd>{hora}</dd></div>
          </dl>
          <label className="campo">
            Motivo de la consulta (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={150} />
          </label>
          <label className="check">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            El paciente ya confirmó el turno
          </label>
          <div className="acciones">
            <button className="boton" onClick={reservar} disabled={guardando}>
              {guardando ? 'Reservando...' : 'Confirmar turno'}
            </button>
            <button className="boton secundario" onClick={() => setHora(null)}>Elegir otro horario</button>
          </div>
        </div>
      )}
    </>
  );
}