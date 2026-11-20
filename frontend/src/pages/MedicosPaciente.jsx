import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Clock } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Avatar from '../components/Avatar';
import { DIAS_CORTOS, DIAS_LARGOS, diaDeSemana, formatoFecha } from '../fechas';

const normalizar = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function MedicosPaciente() {
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [horarios, setHorarios] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/disponibilidad/medicos?proximo=1'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e);
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  const verHorarios = async (m) => {
    if (abierto === m.id) {
      setAbierto(null);
      return;
    }
    setAbierto(m.id);
    if (horarios[m.id]) return;
    try {
      const r = await apiFetch(`/disponibilidad/horarios?medico_id=${m.id}`);
      setHorarios((h) => ({ ...h, [m.id]: r }));
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const q = normalizar(texto.trim());
  const visibles = medicos.filter((m) => {
    if (especialidad && String(m.especialidad_id) !== especialidad) return false;
    if (!q) return true;
    return normalizar(`${m.apellido} ${m.nombre} ${m.especialidad}`).includes(q);
  });

  return (
    <>
      <h1>Médicos</h1>
      <p className="suave">Conocé a los profesionales, sus días de atención y cuándo tienen el próximo turno libre.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="filtros">
        <input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por apellido, nombre o especialidad" aria-label="Buscar médico"
        />
        <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} aria-label="Especialidad">
          <option value="">Todas las especialidades</option>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {!cargado && <p className="suave">Cargando...</p>}
      {cargado && visibles.length === 0 && !error && (
        <p className="suave">
          {medicos.length === 0 ? 'Por ahora no hay médicos disponibles.' : 'No se encontró ningún médico con esa búsqueda.'}
        </p>
      )}

      <div className="medicos-lista">
        {visibles.map((m) => (
          <div className="medico-card" key={m.id}>
            <div className="medico-cab">
              <Avatar nombre={m.nombre} apellido={m.apellido} />
              <div>
                <strong>{m.apellido}, {m.nombre}</strong>
                <div className="suave">{m.especialidad}</div>
              </div>
            </div>

            <div className="dias-chips">
              {m.dias.length === 0 ? (
                <span className="suave">Todavía no tiene horarios cargados.</span>
              ) : (
                m.dias.map((d) => <span key={d} className="dia-chip">{DIAS_CORTOS[d - 1]}</span>)
              )}
            </div>

            {m.dias.length > 0 && (
              <p className="proximo">
                <Clock size={14} />{' '}
                {m.proximo ? (
                  <>
                    Próximo turno libre:{' '}
                    <strong style={{ textTransform: 'capitalize' }}>{diaDeSemana(m.proximo.fecha)}</strong>{' '}
                    {formatoFecha(m.proximo.fecha)} a las {m.proximo.hora}
                  </>
                ) : (
                  'Sin turnos disponibles por ahora'
                )}
              </p>
            )}

            <div className="acciones" style={{ marginTop: 0 }}>
              {m.dias.length > 0 && (
                <button className="boton-chico" onClick={() => verHorarios(m)}>
                  {abierto === m.id ? 'Ocultar horarios' : 'Ver horarios'}
                </button>
              )}
              {m.dias.length > 0 && (
                <Link className="boton-chico" to={`/paciente/sacar-turno?medico=${m.id}`}>
                  <CalendarPlus size={14} /> Sacar turno
                </Link>
              )}
            </div>

            {abierto === m.id && (
              <div className="horarios-semana">
                {!horarios[m.id] ? (
                  <span className="suave">Cargando...</span>
                ) : (
                  <table className="tabla">
                    <thead>
                      <tr><th>Día</th><th>Horario</th><th>Turnos de</th></tr>
                    </thead>
                    <tbody>
                      {horarios[m.id].map((h, i) => (
                        <tr key={i}>
                          <td><strong>{DIAS_LARGOS[h.dia_semana - 1]}</strong></td>
                          <td>{h.hora_inicio} a {h.hora_fin}</td>
                          <td>{h.duracion_min} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}