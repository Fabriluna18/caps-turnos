import { useState } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { ESTADOS } from '../estados';
import { diaDeSemana, formatoFecha, hoyISO, sumarDias } from '../fechas';
import Filtros from './Filtros';
import Reprogramar from './Reprogramar';

const INICIALES = () => ({
  desde: hoyISO(), hasta: sumarDias(hoyISO(), 60), especialidad_id: '', medico_id: '', estado: 'todos', franja: '', q: '',
});

export default function ListaTurnos({ medicos, especialidades = [] }) {
  const [filtros, setFiltros] = useState(INICIALES);
  const [consulta, setConsulta] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [reprogramando, setReprogramando] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Al cambiar la especialidad se borra el médico elegido (puede ser de otra)
  const cambiar = (campo) => (e) =>
    setFiltros({ ...filtros, [campo]: e.target.value, ...(campo === 'especialidad_id' ? { medico_id: '' } : {}) });
  const medicosFiltrados = filtros.especialidad_id
    ? medicos.filter((m) => String(m.especialidad_id) === filtros.especialidad_id)
    : medicos;
  const base = INICIALES();
  const hayFiltro = Object.keys(base).some((k) => filtros[k] !== base[k]);

  const consultar = async (f, pagina) => {
    setError('');
    setCargando(true);
    try {
      const params = new URLSearchParams({ desde: f.desde, hasta: f.hasta, estado: f.estado, pagina: String(pagina) });
      if (f.especialidad_id) params.set('especialidad_id', f.especialidad_id);
      if (f.franja) params.set('franja', f.franja);
      if (f.medico_id) params.set('medico_id', f.medico_id);
      if (f.q.trim()) params.set('q', f.q.trim());
      const r = await apiFetch(`/turnos?${params}`);
      setDatos(r);
      setConsulta(f);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  const buscar = (e) => {
    e.preventDefault();
    setOk('');
    setReprogramando(null);
    consultar(filtros, 1);
  };

  const recargar = () => consultar(consulta, datos ? datos.pagina : 1);

  const confirmar = async (t) => {
    setError('');
    setOk('');
    try {
      await apiFetch(`/turnos/${t.id}/confirmar`, { method: 'PUT' });
      setOk('Turno confirmado');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cancelar = async (t) => {
    if (!window.confirm(`¿Cancelar el turno de ${t.paciente.apellido}, ${t.paciente.nombre} del ${formatoFecha(t.fecha)} a las ${t.hora}? Queda guardado como cancelado y el horario se libera.`)) return;
    setError('');
    setOk('');
    try {
      await apiFetch(`/turnos/${t.id}/cancelar`, { method: 'PUT' });
      setOk('Turno cancelado. El horario quedó libre.');
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const reprogramado = (mensaje) => {
    setReprogramando(null);
    setOk(mensaje);
    recargar();
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const desdeN = datos && datos.total > 0 ? (datos.pagina - 1) * datos.por_pagina + 1 : 0;
  const hastaN = datos ? Math.min(datos.total, datos.pagina * datos.por_pagina) : 0;

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      <div className="panel">
        <h2>Buscar turnos</h2>
        <p className="panel-subtitulo">Por privacidad, no se muestra ningún turno hasta que tocás Buscar.</p>
        <Filtros onSubmit={buscar} hayFiltro={hayFiltro} onLimpiar={() => setFiltros(INICIALES())}>
          <label className="campo">
            Desde
            <input type="date" value={filtros.desde} onChange={cambiar('desde')} required />
          </label>
          <label className="campo">
            Hasta
            <input type="date" value={filtros.hasta} min={filtros.desde} onChange={cambiar('hasta')} required />
          </label>
          <label className="campo">
            Especialidad
            <select value={filtros.especialidad_id} onChange={cambiar('especialidad_id')}>
              <option value="">Todas</option>
              {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <label className="campo">
            Médico
            <select value={filtros.medico_id} onChange={cambiar('medico_id')}>
              <option value="">Todos</option>
              {medicosFiltrados.map((m) => (
                <option key={m.id} value={m.id}>{m.apellido}, {m.nombre}{m.activo ? '' : ' (de baja)'}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            Estado
            <select value={filtros.estado} onChange={cambiar('estado')}>
              <option value="todos">Todos</option>
              {Object.entries(ESTADOS).map(([clave, nombre]) => (
                <option key={clave} value={clave}>{nombre}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            Horario
            <select value={filtros.franja} onChange={cambiar('franja')}>
              <option value="">Mañana y tarde</option>
              <option value="manana">Solo mañana (antes de las 13)</option>
              <option value="tarde">Solo tarde (desde las 13)</option>
            </select>
          </label>
          <label className="campo">
            Paciente (opcional)
            <input value={filtros.q} onChange={cambiar('q')} placeholder="Apellido, nombre o DNI" maxLength={60} />
          </label>
          <button className="boton" type="submit" disabled={cargando}>{cargando ? 'Buscando...' : 'Buscar'}</button>
        </Filtros>
      </div>

      {reprogramando && (
        <Reprogramar turno={reprogramando} onCerrar={() => setReprogramando(null)} onHecho={reprogramado} />
      )}

      <div className="panel">
        <h2>Turnos</h2>
        {!datos ? (
          <p className="suave">Elegí los filtros y tocá Buscar. Hasta entonces no se muestra ningún turno.</p>
        ) : datos.items.length === 0 ? (
          <p className="suave">No hay turnos que coincidan con la búsqueda.</p>
        ) : (
          <>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {datos.items.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong>{formatoFecha(t.fecha)}</strong> <span className="suave">{diaDeSemana(t.fecha)}</span>
                      </td>
                      <td><strong>{t.hora}</strong></td>
                      <td>
                        {t.paciente.apellido}, {t.paciente.nombre}
                        <div className="suave">DNI {t.paciente.dni}{t.motivo ? ` · ${t.motivo}` : ''}</div>
                      </td>
                      <td>{t.medico.apellido}, {t.medico.nombre}<div className="suave">{t.medico.especialidad}</div></td>
                      <td><span className={`estado ${t.estado}`}>{ESTADOS[t.estado]}</span></td>
                      <td>
                        {t.modificable ? (
                          <div className="acciones-fila">
                            {t.estado === 'pendiente' && (
                              <button className="boton-chico" onClick={() => confirmar(t)}><Check size={14} /> Confirmar</button>
                            )}
                            <button className="boton-chico" onClick={() => setReprogramando(t)}>
                              <CalendarClock size={14} /> Reprogramar
                            </button>
                            <button className="boton-chico peligro" onClick={() => cancelar(t)}><X size={14} /> Cancelar</button>
                          </div>
                        ) : (
                          <span className="suave">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="paginacion">
              <span className="suave">Mostrando {desdeN} a {hastaN} de {datos.total}</span>
              <div className="botones">
                <button className="boton-chico" disabled={datos.pagina <= 1 || cargando} onClick={() => consultar(consulta, datos.pagina - 1)}>Anterior</button>
                <span className="suave">Página {datos.pagina} de {totalPaginas}</span>
                <button className="boton-chico" disabled={datos.pagina >= totalPaginas || cargando} onClick={() => consultar(consulta, datos.pagina + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}