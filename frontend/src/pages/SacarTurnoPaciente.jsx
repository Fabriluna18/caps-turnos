import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import BuscadorMedico from '../components/BuscadorMedico';
import CalendarioDisponibilidad from '../components/CalendarioDisponibilidad';
import Encabezado from '../components/Encabezado';
import HorariosDelDia from '../components/HorariosDelDia';
import { diaDeSemana, formatoFecha } from '../fechas';

export default function SacarTurnoPaciente() {
  const [params] = useSearchParams();
  const medicoDelEnlace = Number(params.get('medico')) || null; // viene de "Sacar turno" en la lista de médicos
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [medico, setMedico] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [version, setVersion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch('/disponibilidad/medicos'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e);
        if (medicoDelEnlace) setMedico(m.find((x) => x.id === medicoDelEnlace) || null);
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [medicoDelEnlace]);

  const elegirMedico = (m) => {
    setMedico(m);
    setFecha(null);
    setHora(null);
  };

  const reservar = async () => {
    setError('');
    setGuardando(true);
    try {
      const r = await apiFetch('/paciente/turnos', {
        method: 'POST',
        body: JSON.stringify({ medico_id: medico.id, fecha, hora, motivo }),
      });
      setHecho(r);
    } catch (err) {
      setError(mensajeDeError(err));
      setHora(null);
      setVersion((v) => v + 1); // se recarga la grilla: puede que el horario se haya ocupado
    } finally {
      setGuardando(false);
    }
  };

  const otro = () => {
    setHecho(null);
    setMedico(null);
    setFecha(null);
    setHora(null);
    setMotivo('');
    setError('');
    setVersion((v) => v + 1);
  };

  if (hecho) {
    const t = hecho.turno;
    return (
      <>
        <h1>Sacar turno</h1>
        <div className="panel">
          <h2>¡Turno reservado!</h2>
          <dl className="datos">
            <div><dt>Médico</dt><dd>{t.medico.apellido}, {t.medico.nombre} ({t.medico.especialidad})</dd></div>
            <div><dt>Día</dt><dd style={{ textTransform: 'capitalize' }}>{diaDeSemana(t.fecha)} {formatoFecha(t.fecha)}</dd></div>
            <div><dt>Hora</dt><dd>{t.hora}</dd></div>
            <div><dt>Estado</dt><dd>Pendiente de confirmación</dd></div>
          </dl>
          {hecho.sin_email ? (
            <p className="error">
              No tenés un email cargado, así que no vas a recibir el recordatorio. Cargalo en{' '}
              <Link className="enlace" to="/paciente/perfil">Mi perfil</Link> para poder confirmar el turno desde el mail.
            </p>
          ) : (
            <p className="suave">
              Un tiempo antes del turno te vamos a mandar un mail con un enlace para confirmarlo. Si no podés asistir,
              avisá para que otra persona use el horario.
            </p>
          )}
          <div className="acciones">
            <Link className="boton" to="/paciente">Ir al inicio</Link>
            <button className="boton secundario" onClick={otro}>Sacar otro turno</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Sacar turno" subtitulo="Elegí el médico, el día y el horario. Podés tener hasta 5 turnos a la vez." />
      {error && <p className="error" role="alert">{error}</p>}

      <div className="panel">
        <h2>1. Médico</h2>
        {medico ? (
          <div className="seleccion">
            <div>
              <strong>{medico.apellido}, {medico.nombre}</strong>
              <div className="suave">{medico.especialidad}</div>
            </div>
            <button className="boton-chico" onClick={() => elegirMedico(null)}>Cambiar</button>
          </div>
        ) : (
          <BuscadorMedico medicos={medicos} especialidades={especialidades} onElegir={elegirMedico} />
        )}
      </div>

      {medico && (
        <>
          {medico.dias.length === 0 && <p className="suave">Este médico todavía no tiene horarios cargados.</p>}
          <div className="dos-columnas">
            <CalendarioDisponibilidad
              medicoId={medico.id} fechaElegida={fecha} soloConTurnos version={version}
              onElegir={(f) => { setFecha(f); setHora(null); }}
            />
            <HorariosDelDia
              medicoId={medico.id} fecha={fecha} onElegirHora={(t) => setHora(t.hora)}
              horaElegida={hora} version={version}
            />
          </div>
        </>
      )}

      {medico && fecha && hora && (
        <div className="panel">
          <h2>2. Confirmar</h2>
          <dl className="datos">
            <div><dt>Médico</dt><dd>{medico.apellido}, {medico.nombre} ({medico.especialidad})</dd></div>
            <div><dt>Día</dt><dd style={{ textTransform: 'capitalize' }}>{diaDeSemana(fecha)} {formatoFecha(fecha)}</dd></div>
            <div><dt>Hora</dt><dd>{hora}</dd></div>
          </dl>
          <label className="campo">
            Motivo de la consulta (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={150} />
          </label>
          <div className="acciones">
            <button className="boton" onClick={reservar} disabled={guardando}>
              {guardando ? 'Reservando...' : 'Reservar turno'}
            </button>
            <button className="boton secundario" onClick={() => setHora(null)}>Elegir otro horario</button>
          </div>
        </div>
      )}
    </>
  );
}
