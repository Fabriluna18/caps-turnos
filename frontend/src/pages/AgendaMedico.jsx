import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, FileText, History, Stethoscope } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import FichaClinica from '../components/FichaClinica';
import HistorialPaciente from '../components/HistorialPaciente';
import RecetaForm from '../components/RecetaForm';
import { ESTADOS } from '../estados';
import { diaDeSemana, formatoFecha, hoyISO, sumarDias } from '../fechas';

export default function AgendaMedico() {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(hoyISO());
  const [agenda, setAgenda] = useState(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [recetaDe, setRecetaDe] = useState(null); // turno al que se le está haciendo receta
  const [recetaHecha, setRecetaHecha] = useState(null);
  const [historialDe, setHistorialDe] = useState(null); // id del turno cuyo historial se muestra
  const [fichaDe, setFichaDe] = useState(null); // id del paciente cuya ficha se muestra

  const cargar = useCallback(() => {
    apiFetch(`/medico/agenda?fecha=${fecha}`)
      .then((r) => {
        setAgenda(r);
        setError('');
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al cambiar de día se limpia lo que estaba abierto del día anterior
  const cambiarFecha = (f) => {
    setFecha(f);
    setAgenda(null);
    setRecetaDe(null);
    setHistorialDe(null);
    setFichaDe(null);
  };

  const recetaLista = (id) => {
    setRecetaDe(null);
    setRecetaHecha(id);
    cargar();
  };

  // El día de hoy se actualiza solo cada minuto (por si la secretaría cambia algo)
  useEffect(() => {
    if (fecha !== hoyISO()) return undefined;
    const id = setInterval(cargar, 60000);
    return () => clearInterval(id);
  }, [fecha, cargar]);

  const marcar = async (t, estado) => {
    setError('');
    setTrabajando(true);
    try {
      await apiFetch(`/medico/turnos/${t.id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) });
      // Al empezar la consulta se abre directamente la pantalla de atención
      if (estado === 'en_atencion') navigate(`/medico/atencion/${t.id}`);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setTrabajando(false);
      cargar();
    }
  };

  return (
    <>
      <h1>Agenda del día</h1>
      <div className="acciones" style={{ marginTop: 0 }}>
        <button className="boton-chico" onClick={() => cambiarFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
          <ChevronLeft size={16} />
        </button>
        <input type="date" value={fecha} onChange={(e) => e.target.value && cambiarFecha(e.target.value)} aria-label="Elegir día" />
        <button className="boton-chico" onClick={() => cambiarFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
          <ChevronRight size={16} />
        </button>
        {fecha !== hoyISO() && <button className="boton-chico secundario" onClick={() => cambiarFecha(hoyISO())}>Hoy</button>}
      </div>
      <h2 style={{ textTransform: 'capitalize' }}>{diaDeSemana(fecha)} {formatoFecha(fecha)}</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {recetaHecha && (
        <p className="exito" role="status">
          Receta emitida.{' '}
          <a className="enlace" href={`/receta/${recetaHecha}`} target="_blank" rel="noopener noreferrer">Verla e imprimirla</a>
        </p>
      )}
      {!agenda && !error && <p className="suave">Cargando...</p>}

      {agenda && (
        <>
          <div className="acciones" style={{ marginTop: 0 }}>
            {Object.entries(agenda.conteo).map(([estado, n]) => (
              <span key={estado} className={`estado ${estado}`}>{ESTADOS[estado]}: {n}</span>
            ))}
            {agenda.cancelados > 0 && <span className="suave">({agenda.cancelados} cancelado{agenda.cancelados > 1 ? 's' : ''})</span>}
          </div>

          {agenda.turnos.length === 0 && <p className="suave">No hay turnos para este día.</p>}
          {!agenda.puede_marcar && agenda.turnos.length > 0 && (
            <p className="suave">Es un día futuro: podés ver los turnos, pero todavía no se pueden atender.</p>
          )}

          {agenda.turnos.length > 0 && (
            <div className="panel">
              <table className="tabla">
                <thead>
                  <tr><th>Hora</th><th>Paciente</th><th>Motivo</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {agenda.turnos.map((t) => {
                    const abierto = ['pendiente', 'confirmado', 'en_atencion'].includes(t.estado);
                    return (
                      <tr key={t.id} style={t.estado === 'en_atencion' ? { fontWeight: 600 } : undefined}>
                        <td><strong>{t.hora}</strong></td>
                        <td>
                          {t.paciente.apellido}, {t.paciente.nombre}
                          <div className="suave">
                            DNI {t.paciente.dni}
                            {t.paciente.edad != null ? ` · ${t.paciente.edad} años` : ''}
                            {t.paciente.cobertura ? ` · ${t.paciente.cobertura}` : ''}
                          </div>
                          {t.paciente.alergias && (
                            <div className="error" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 8px', marginTop: 4 }}>
                              <AlertTriangle size={12} /> Alergias: {t.paciente.alergias}
                            </div>
                          )}
                        </td>
                        <td>{t.motivo || <span className="suave">—</span>}</td>
                        <td><span className={`estado ${t.estado}`}>{ESTADOS[t.estado]}</span></td>
                        <td>
                          <button
                            className="boton-chico secundario" style={{ marginBottom: 4 }}
                            onClick={() => { setRecetaDe(null); setFichaDe(null); setHistorialDe(historialDe === t.id ? null : t.id); }}
                          >
                            <History size={14} /> Historial
                          </button>{' '}
                          <button
                            className="boton-chico secundario" style={{ marginBottom: 4 }}
                            onClick={() => { setRecetaDe(null); setHistorialDe(null); setFichaDe(fichaDe === t.paciente.id ? null : t.paciente.id); }}
                          >
                            <ClipboardList size={14} /> Ficha
                          </button>
                          {agenda.puede_marcar && (
                            <div className="acciones" style={{ marginTop: 0 }}>
                              {(t.estado === 'pendiente' || t.estado === 'confirmado') && (
                                <button className="boton-chico" disabled={trabajando} onClick={() => marcar(t, 'en_atencion')}>Atender</button>
                              )}
                              {abierto && (
                                <button className="boton-chico" disabled={trabajando} onClick={() => marcar(t, 'atendido')}>Atendido</button>
                              )}
                              {abierto && t.estado !== 'en_atencion' && (
                                <button className="boton-chico secundario" disabled={trabajando} onClick={() => marcar(t, 'ausente')}>Ausente</button>
                              )}
                              {(t.estado === 'en_atencion' || (t.estado === 'atendido' && t.con_atencion)) && (
                                <Link className="boton-chico" to={`/medico/atencion/${t.id}`}>
                                  <Stethoscope size={14} /> {t.estado === 'en_atencion' ? 'Atención' : 'Ver atención'}
                                </Link>
                              )}
                              {(t.estado === 'en_atencion' || t.estado === 'atendido') && (
                                <button
                                  className="boton-chico secundario"
                                  onClick={() => { setRecetaHecha(null); setHistorialDe(null); setFichaDe(null); setRecetaDe(t); }}
                                >
                                  <FileText size={14} /> Receta{t.recetas > 0 ? ` (${t.recetas})` : ''}
                                </button>
                              )}
                              {t.estado === 'ausente' && (
                                <button className="boton-chico secundario" disabled={trabajando} onClick={() => marcar(t, 'en_atencion')}>Llegó</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="leyenda">Una vez marcado como atendido, el turno ya no se puede modificar.</p>
            </div>
          )}

          {fichaDe && <FichaClinica key={fichaDe} pacienteId={fichaDe} onCerrar={() => { setFichaDe(null); cargar(); }} />}
          {historialDe && <HistorialPaciente key={historialDe} turnoId={historialDe} onCerrar={() => setHistorialDe(null)} />}
          {recetaDe && <RecetaForm key={recetaDe.id} turno={recetaDe} onListo={recetaLista} onCerrar={() => setRecetaDe(null)} />}
        </>
      )}
    </>
  );
}
