import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { ESTADOS } from '../estados';
import { diaDeSemana, formatoFecha } from '../fechas';

const TABS = [
  { id: 'proximos', texto: 'Próximos' },
  { id: 'historial', texto: 'Historial' },
  { id: 'cancelados', texto: 'Cancelados' },
];

const VACIO = {
  proximos: 'No tenés turnos próximos.',
  historial: 'Todavía no tenés turnos en tu historial.',
  cancelados: 'No tenés turnos cancelados.',
};

export default function MisTurnos() {
  const [tab, setTab] = useState('proximos');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [cancelando, setCancelando] = useState(null); // id del turno que pide confirmación
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(() => {
    apiFetch(`/paciente/turnos?tab=${tab}&pagina=${pagina}`)
      .then((r) => {
        setDatos(r);
        setError('');
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [tab, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al cambiar de pestaña o de página se muestra "Cargando..." hasta que llegan los turnos
  const irPagina = (p) => {
    setDatos(null);
    setPagina(p);
  };

  const cambiarTab = (id) => {
    setTab(id);
    irPagina(1);
    setCancelando(null);
    setOk('');
  };

  const accion = async (t, que) => {
    setError('');
    setOk('');
    setTrabajando(true);
    try {
      await apiFetch(`/paciente/turnos/${t.id}/${que}`, { method: 'PUT' });
      setOk(que === 'confirmar' ? 'Turno confirmado.' : 'Turno cancelado. El horario quedó libre para otras personas.');
      setCancelando(null);
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
      setCancelando(null);
      cargar();
    } finally {
      setTrabajando(false);
    }
  };

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <>
      <h1>Mis turnos</h1>
      <p className="suave">Tus turnos próximos, tu historial y los que cancelaste.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <div className="acciones" role="tablist" style={{ marginTop: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id}
            className={tab === t.id ? 'boton-chico' : 'boton-chico secundario'}
            style={tab === t.id ? { fontWeight: 700 } : undefined}
            onClick={() => cambiarTab(t.id)}
          >
            {t.texto}
          </button>
        ))}
        <Link className="boton-chico" to="/paciente/sacar-turno">Sacar turno</Link>
      </div>

      {!datos && !error && <p className="suave">Cargando...</p>}
      {datos && datos.items.length === 0 && <p className="suave">{VACIO[tab]}</p>}

      {datos && datos.items.length > 0 && (
        <div className="panel">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Hora</th><th>Médico</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {datos.items.map((t) => (
                <tr key={t.id}>
                  <td><strong>{formatoFecha(t.fecha)}</strong> <span className="suave">{diaDeSemana(t.fecha)}</span></td>
                  <td><strong>{t.hora}</strong></td>
                  <td>
                    {t.medico.apellido}, {t.medico.nombre}
                    <div className="suave">{t.medico.especialidad}{t.motivo ? ` · ${t.motivo}` : ''}</div>
                  </td>
                  <td><span className={`estado ${t.estado}`}>{ESTADOS[t.estado]}</span></td>
                  <td>
                    {t.modificable && cancelando !== t.id && (
                      <div className="acciones" style={{ marginTop: 0 }}>
                        {t.estado === 'pendiente' && (
                          <button className="boton-chico" disabled={trabajando} onClick={() => accion(t, 'confirmar')}>Confirmar</button>
                        )}
                        <button className="boton-chico secundario" disabled={trabajando} onClick={() => setCancelando(t.id)}>Cancelar</button>
                      </div>
                    )}
                    {t.modificable && cancelando === t.id && (
                      <div>
                        <div className="suave">¿Cancelar este turno?</div>
                        <div className="acciones" style={{ marginTop: 4 }}>
                          <button className="boton-chico" disabled={trabajando} onClick={() => accion(t, 'cancelar')}>Sí, cancelar</button>
                          <button className="boton-chico secundario" onClick={() => setCancelando(null)}>No</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tab === 'historial' && (
            <p className="leyenda">
              Si ves un turno "Pendiente" o "Confirmado" de una fecha pasada, es que no llegó a registrarse la atención.
            </p>
          )}
          {paginas > 1 && (
            <div className="acciones">
              <button className="boton-chico" disabled={pagina <= 1} onClick={() => irPagina(pagina - 1)}>Anterior</button>
              <span className="suave">Página {pagina} de {paginas}</span>
              <button className="boton-chico" disabled={pagina >= paginas} onClick={() => irPagina(pagina + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
