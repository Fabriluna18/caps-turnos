import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, CalendarPlus } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';
import CalendarioSemanal from '../components/CalendarioSemanal';
import { diaDeSemana, formatoFecha } from '../fechas';

const tarjeta = { display: 'flex', flexDirection: 'column', gap: 4 };

export default function InicioSecretaria() {
  const usuario = usuarioActual();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = () =>
      apiFetch('/secretaria/resumen')
        .then((d) => {
          setR(d);
          setError('');
        })
        .catch((err) => setError(mensajeDeError(err)));
    cargar();
    const id = setInterval(cargar, 60000); // se actualiza solo cada minuto
    return () => clearInterval(id);
  }, []);

  const avisos = r
    ? [
        ...r.avisos.feriados.map((f) => `Feriado el ${formatoFecha(f.fecha)}: ${f.descripcion}`),
        ...r.avisos.licencias.map((l) => `Licencia de ${l.medico}: del ${formatoFecha(l.desde)} al ${formatoFecha(l.hasta)}`),
        ...r.avisos.sin_horarios.map((m) => `${m} no tiene horarios cargados (no se le pueden dar turnos)`),
      ]
    : [];

  return (
    <>
      <h1>Hola, {usuario.nombre}</h1>
      {r && (
        <p className="suave" style={{ textTransform: 'capitalize' }}>{diaDeSemana(r.fecha)} {formatoFecha(r.fecha)}</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {!r && !error && <p className="suave">Cargando...</p>}

      {r && (
        <>
          <div className="dato-cards">
            <div className="dato-card principal" style={tarjeta}>
              <span className="dato-titulo">Turnos de hoy</span>
              <strong className="dato-grande">{r.hoy.turnos}</strong>
              <span className="suave">{r.hoy.confirmados} confirmado{r.hoy.confirmados === 1 ? '' : 's'} · {r.hoy.en_atencion} en atención</span>
            </div>
            <div className="dato-card" style={tarjeta}>
              <span className="dato-titulo">Sin confirmar hoy</span>
              <strong className="dato-grande">{r.hoy.sin_confirmar}</strong>
              <span className="suave">Mañana: {r.manana.sin_confirmar} de {r.manana.turnos}</span>
            </div>
            <div className="dato-card" style={tarjeta}>
              <span className="dato-titulo">Atendidos hoy</span>
              <strong className="dato-grande">{r.hoy.atendidos}</strong>
              <span className="suave">{r.hoy.ausentes} ausente{r.hoy.ausentes === 1 ? '' : 's'}</span>
            </div>
            <div className="dato-card" style={tarjeta}>
              <span className="dato-titulo">Atendidos este mes</span>
              <strong className="dato-grande">{r.atendidos_mes}</strong>
              <Link className="enlace" to="/secretaria/reportes">Ver reportes</Link>
            </div>
          </div>

          {r.hoy.atrasados > 0 && (
            <p className="error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={16} />
              {r.hoy.atrasados === 1
                ? 'Hay 1 turno de hoy que ya pasó de hora y sigue abierto. El médico tiene que marcarlo como atendido o ausente.'
                : `Hay ${r.hoy.atrasados} turnos de hoy que ya pasaron de hora y siguen abiertos. El médico tiene que marcarlos como atendidos o ausentes.`}
            </p>
          )}

          <div className="acciones">
            <Link className="boton" to="/secretaria/turnos"><CalendarPlus size={16} /> Turnos</Link>
            <Link className="boton secundario" to="/secretaria/reportes"><BarChart3 size={16} /> Reportes</Link>
          </div>

          <div className="panel">
            <h2>Hoy por médico</h2>
            {r.por_medico.length === 0 ? (
              <p className="suave">Hoy no atiende ningún médico.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr><th>Médico</th><th>Turnos</th><th>Atendidos</th><th>Sin confirmar</th><th>Libres</th></tr>
                  </thead>
                  <tbody>
                    {r.por_medico.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.apellido}, {m.nombre}</strong>
                          <div className="suave">{m.especialidad}</div>
                          {m.en_atencion > 0 && <span className="estado en_atencion">Atendiendo</span>}
                          {m.motivo === 'licencia' && <span className="estado cancelado">De licencia</span>}
                        </td>
                        <td>{m.turnos}</td>
                        <td>{m.atendidos}</td>
                        <td>{m.sin_confirmar}</td>
                        <td>{m.libres}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {avisos.length > 0 && (
            <div className="panel">
              <h2>Avisos</h2>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {avisos.map((a) => <li key={a} style={{ marginBottom: 6 }}>{a}</li>)}
              </ul>
            </div>
          )}

          <CalendarioSemanal />
        </>
      )}
    </>
  );
}
