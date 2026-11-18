import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Stethoscope } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';
import { ESTADOS } from '../estados';
import { diaDeSemana, formatoFecha } from '../fechas';

export default function InicioPaciente() {
  const usuario = usuarioActual();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/paciente/resumen')
      .then(setResumen)
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  return (
    <>
      <h1>Hola, {usuario.nombre}</h1>
      <p className="suave">Acá ves tus próximos turnos y los médicos disponibles.</p>
      {error && <p className="error" role="alert">{error}</p>}

      {!resumen && !error && <p className="suave">Cargando...</p>}

      {resumen && (
        <>
          <div className="dato-cards">
            <div className="dato-card principal">
              <span className="dato-titulo">Próximo turno</span>
              {resumen.proximo ? (
                <>
                  <strong className="dato-grande" style={{ textTransform: 'capitalize' }}>
                    {diaDeSemana(resumen.proximo.fecha)} {formatoFecha(resumen.proximo.fecha)}
                  </strong>
                  <span className="dato-hora">{resumen.proximo.hora} hs</span>
                  <span>
                    {resumen.proximo.medico.apellido}, {resumen.proximo.medico.nombre}
                    <span className="suave"> · {resumen.proximo.medico.especialidad}</span>
                  </span>
                  <span className={`estado ${resumen.proximo.estado}`}>{ESTADOS[resumen.proximo.estado]}</span>
                </>
              ) : (
                <>
                  <strong className="dato-grande">No tenés turnos próximos</strong>
                  <Link className="boton-chico" to="/paciente/sacar-turno"><CalendarPlus size={14} /> Sacar un turno</Link>
                </>
              )}
            </div>

            <div className="dato-card">
              <span className="dato-titulo">Turnos este mes</span>
              <strong className="dato-grande">{resumen.turnos_mes}</strong>
              <span className="suave">No cuenta los cancelados.</span>
            </div>
          </div>

          {resumen.siguientes.length > 0 && (
            <div className="panel">
              <h2>Tus siguientes turnos</h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr><th>Fecha</th><th>Hora</th><th>Médico</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {resumen.siguientes.map((t) => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatoFecha(t.fecha)}</strong> <span className="suave">{diaDeSemana(t.fecha)}</span>
                        </td>
                        <td><strong>{t.hora}</strong></td>
                        <td>
                          {t.medico.apellido}, {t.medico.nombre}
                          <div className="suave">{t.medico.especialidad}</div>
                        </td>
                        <td><span className={`estado ${t.estado}`}>{ESTADOS[t.estado]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resumen.total_proximos > resumen.siguientes.length + 1 && (
                <p className="suave" style={{ marginBottom: 0 }}>
                  Mostrando {resumen.siguientes.length + 1} de tus {resumen.total_proximos} turnos próximos. La lista
                  completa va a estar en Mis turnos.
                </p>
              )}
              <p className="leyenda">
                <strong>Pendiente</strong> quiere decir que el turno está reservado pero todavía no lo confirmaste.
              </p>
            </div>
          )}

          {resumen.sin_email && (
            <div className="aviso-dia" style={{ marginBottom: 20 }}>
              No tenés un email cargado. Agregalo en <Link className="enlace" to="/paciente/perfil">Mi perfil</Link> para
              recibir los recordatorios de tus turnos.
            </div>
          )}

          <div className="acciones">
            <Link className="boton" to="/paciente/medicos"><Stethoscope size={16} /> Ver médicos</Link>
            <Link className="boton secundario" to="/paciente/sacar-turno"><CalendarPlus size={16} /> Sacar turno</Link>
          </div>
        </>
      )}
    </>
  );
}