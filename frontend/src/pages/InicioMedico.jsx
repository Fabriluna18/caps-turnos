import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, FileText } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';
import { ESTADOS } from '../estados';
import { diaDeSemana, formatoFecha } from '../fechas';

export default function InicioMedico() {
  const usuario = usuarioActual();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = () =>
      apiFetch('/medico/resumen')
        .then((d) => {
          setR(d);
          setError('');
        })
        .catch((err) => setError(mensajeDeError(err)));
    cargar();
    const id = setInterval(cargar, 60000); // se actualiza solo cada minuto
    return () => clearInterval(id);
  }, []);

  const paciente = (t) => `${t.paciente.apellido}, ${t.paciente.nombre}`;

  return (
    <>
      <h1>Hola, {usuario.nombre}</h1>
      {r && (
        <p className="suave" style={{ textTransform: 'capitalize' }}>
          {diaDeSemana(r.fecha)} {formatoFecha(r.fecha)}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {!r && !error && <p className="suave">Cargando...</p>}

      {r && (
        <>
          <div className="dato-cards">
            <div className="dato-card principal">
              <span className="dato-titulo">{r.en_atencion ? 'Atendiendo ahora' : 'Siguiente paciente'}</span>
              {r.en_atencion || r.siguiente ? (
                <>
                  <strong className="dato-grande">{paciente(r.en_atencion || r.siguiente)}</strong>
                  <span className="dato-hora">{(r.en_atencion || r.siguiente).hora} hs</span>
                  {(r.en_atencion || r.siguiente).motivo && <span className="suave">{(r.en_atencion || r.siguiente).motivo}</span>}
                  {r.en_atencion && r.siguiente && (
                    <span className="suave">Después: {paciente(r.siguiente)} ({r.siguiente.hora})</span>
                  )}
                </>
              ) : (
                <strong className="dato-grande">{r.hoy.total ? 'No queda nadie esperando' : 'Hoy no tenés turnos'}</strong>
              )}
            </div>

            <div className="dato-card">
              <span className="dato-titulo">Turnos de hoy</span>
              <strong className="dato-grande">{r.hoy.total}</strong>
              <div className="acciones" style={{ marginTop: 4 }}>
                {Object.entries(r.hoy.conteo).map(([estado, n]) => (
                  <span key={estado} className={`estado ${estado}`}>{ESTADOS[estado]}: {n}</span>
                ))}
              </div>
            </div>

            <div className="dato-card">
              <span className="dato-titulo">Próximos 7 días</span>
              <strong className="dato-grande">{r.proximos_7_dias}</strong>
              <span className="suave">turnos reservados</span>
            </div>

            <div className="dato-card">
              <span className="dato-titulo">Este mes</span>
              <strong className="dato-grande">{r.mes.atendidos}</strong>
              <span className="suave">pacientes atendidos · {r.mes.recetas} receta{r.mes.recetas === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="acciones">
            <Link className="boton" to="/medico/agenda"><CalendarDays size={16} /> Ir a la agenda</Link>
            <Link className="boton secundario" to="/medico/recetas"><FileText size={16} /> Mis recetas</Link>
          </div>
        </>
      )}
    </>
  );
}
