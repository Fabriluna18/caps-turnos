import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { diaDeSemana, formatoFecha } from '../fechas';

// Página pública: se llega desde el enlace del mail, sin iniciar sesión
export default function Confirmar() {
  const { token } = useParams();
  const [turno, setTurno] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiFetch(`/confirmar/${token}`)
      .then((r) => setTurno(r.turno))
      .catch((err) => setError(mensajeDeError(err)));
  }, [token]);

  const confirmar = async () => {
    setError('');
    setEnviando(true);
    try {
      const r = await apiFetch(`/confirmar/${token}`, { method: 'POST' });
      setTurno(r.turno);
      setMensaje(r.mensaje);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="centrado">
      <div className="tarjeta">
        <h1>Confirmar turno</h1>
        {error && <p className="error" role="alert">{error}</p>}
        {!turno && !error && <p className="suave">Cargando...</p>}
        {turno && (
          <>
            <dl className="datos">
              <div><dt>Médico</dt><dd>{turno.medico_apellido} ({turno.especialidad})</dd></div>
              <div><dt>Día</dt><dd style={{ textTransform: 'capitalize' }}>{diaDeSemana(turno.fecha)} {formatoFecha(turno.fecha)}</dd></div>
              <div><dt>Hora</dt><dd>{turno.hora}</dd></div>
            </dl>
            {mensaje && <p className="exito" role="status">{mensaje}</p>}
            {!mensaje && turno.estado === 'confirmado' && <p className="exito">Tu turno ya está confirmado.</p>}
            {!mensaje && turno.estado === 'pendiente' && turno.vigente && (
              <button className="boton" onClick={confirmar} disabled={enviando}>
                {enviando ? 'Confirmando...' : 'Confirmar turno'}
              </button>
            )}
            {!mensaje && turno.estado !== 'pendiente' && turno.estado !== 'confirmado' && (
              <p className="suave">Este turno está {turno.estado === 'cancelado' ? 'cancelado' : 'cerrado'}.</p>
            )}
            {!mensaje && turno.estado === 'pendiente' && !turno.vigente && <p className="suave">Ese turno ya pasó.</p>}
          </>
        )}
        <p className="pie-tarjeta"><Link className="enlace" to="/login">Ir al ingreso</Link></p>
      </div>
    </div>
  );
}
