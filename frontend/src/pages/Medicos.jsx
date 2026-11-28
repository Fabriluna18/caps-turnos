import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Search, UserCheck, UserPlus, UserX } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Encabezado from '../components/Encabezado';
import Especialidades from '../components/Especialidades';
import Filtros from '../components/Filtros';
import VentanaFlotante from '../components/VentanaFlotante';

const VACIO = { dni: '', nombre: '', apellido: '', email: '', telefono: '', matricula: '', especialidad_id: '' };

export default function Medicos() {
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEsp, setFiltroEsp] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [clave, setClave] = useState(null);
  const [copiada, setCopiada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const recargar = async () => {
    try {
      const [m, e] = await Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')]);
      setMedicos(m);
      setEspecialidades(e);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  useEffect(() => {
    Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e);
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const limpiarMensajes = () => {
    setError('');
    setOk('');
  };

  const cerrarFormulario = () => {
    setFormAbierto(false);
    setEditando(null);
    setForm(VACIO);
    setError('');
  };

  const nuevo = () => {
    limpiarMensajes();
    setClave(null);
    setEditando(null);
    setForm(VACIO);
    setFormAbierto(true);
  };

  const editar = (m) => {
    limpiarMensajes();
    setClave(null);
    setFormAbierto(true);
    setEditando(m.id);
    setForm({
      dni: m.dni,
      nombre: m.nombre,
      apellido: m.apellido,
      email: m.email || '',
      telefono: m.telefono || '',
      matricula: m.matricula,
      especialidad_id: String(m.especialidad_id),
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    limpiarMensajes();
    setClave(null);
    setCargando(true);
    try {
      if (editando) {
        await apiFetch(`/medicos/${editando}`, { method: 'PUT', body: JSON.stringify(form) });
        cerrarFormulario();
        setOk('Datos actualizados');
      } else {
        const r = await apiFetch('/medicos', { method: 'POST', body: JSON.stringify(form) });
        cerrarFormulario();
        setClave({ nombre: `${r.medico.nombre} ${r.medico.apellido}`, valor: r.clave_temporal });
        setCopiada(false);
      }
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err)); // se muestra dentro de la ventana, que queda abierta
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (m) => {
    limpiarMensajes();
    try {
      await apiFetch(`/medicos/${m.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !m.activo }) });
      setOk(`${m.nombre} ${m.apellido} ${m.activo ? 'quedó dado de baja' : 'fue reactivado'}`);
      await recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const nuevaClave = async (m) => {
    if (!window.confirm(`¿Generar una clave temporal nueva para ${m.nombre} ${m.apellido}? La anterior deja de funcionar.`)) return;
    limpiarMensajes();
    try {
      const r = await apiFetch(`/medicos/${m.id}/reset-clave`, { method: 'POST' });
      setClave({ nombre: `${m.nombre} ${m.apellido}`, valor: r.clave_temporal });
      setCopiada(false);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave.valor);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setError('No se pudo copiar. Seleccioná la clave y copiala a mano.');
    }
  };

  // Filtros: por nombre, apellido, DNI o matrícula; por especialidad y por estado
  const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = sinTildes(busqueda.trim());
  const filtrados = medicos.filter((m) => {
    if (filtroEsp && String(m.especialidad_id) !== filtroEsp) return false;
    if (filtroEstado === 'activos' && !m.activo) return false;
    if (filtroEstado === 'baja' && m.activo) return false;
    if (!q) return true;
    const texto = sinTildes(`${m.apellido} ${m.nombre} ${m.nombre} ${m.apellido} ${m.dni} ${m.matricula}`);
    return texto.includes(q);
  });
  const hayFiltro = Boolean(q || filtroEsp || filtroEstado !== 'todos');

  return (
    <>
      <Encabezado titulo="Médicos" subtitulo="El equipo médico del CAPS: alta, edición, baja y claves de ingreso. Abajo, las especialidades.">
        <button className="boton" onClick={nuevo}><UserPlus size={18} /> Nuevo médico</button>
      </Encabezado>
      {error && !formAbierto && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {clave && (
        <div className="clave-temporal" role="status">
          <strong>Clave temporal de {clave.nombre}</strong>
          <code>{clave.valor}</code>
          <p className="suave">
            Anotala y entregásela en persona: no se vuelve a mostrar. La va a tener que cambiar en su primer ingreso.
          </p>
          <div className="acciones">
            <button className="boton secundario" onClick={copiar}>{copiada ? 'Copiada ✓' : 'Copiar'}</button>
            <button className="boton secundario" onClick={() => setClave(null)}>Listo</button>
          </div>
        </div>
      )}

      {formAbierto && (
        <VentanaFlotante titulo={editando ? 'Editar médico' : 'Nuevo médico'} onCerrar={cerrarFormulario}>
        {error && <p className="error" role="alert">{error}</p>}
        <form onSubmit={guardar}>
          <div className="grilla-form">
            <label className="campo">
              DNI
              <input
                name="dni" value={form.dni} onChange={cambiar} inputMode="numeric"
                maxLength={10} disabled={Boolean(editando)} required
              />
            </label>
            <label className="campo">
              Nombre
              <input name="nombre" value={form.nombre} onChange={cambiar} maxLength={80} required />
            </label>
            <label className="campo">
              Apellido
              <input name="apellido" value={form.apellido} onChange={cambiar} maxLength={80} required />
            </label>
            <label className="campo">
              Matrícula
              <input name="matricula" value={form.matricula} onChange={cambiar} maxLength={20} required />
            </label>
            <label className="campo">
              Especialidad
              <select name="especialidad_id" value={form.especialidad_id} onChange={cambiar} required>
                <option value="">Elegí una...</option>
                {especialidades.filter((esp) => esp.activa).map((esp) => (
                  <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              Email (opcional)
              <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} />
            </label>
            <label className="campo">
              Teléfono (opcional)
              <input name="telefono" value={form.telefono} onChange={cambiar} maxLength={30} />
            </label>
          </div>
          <div className="acciones">
            <button className="boton" type="submit" disabled={cargando}>
              {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar médico'}
            </button>
            <button className="boton secundario" type="button" onClick={cerrarFormulario}>Cancelar</button>
          </div>
        </form>
        </VentanaFlotante>
      )}

      <div className="panel">
        <h2>Equipo médico</h2>
        <p className="panel-subtitulo">
          {hayFiltro ? `Mostrando ${filtrados.length} de ${medicos.length} médicos` : `${medicos.length} médicos cargados`}
        </p>
        {medicos.length > 0 && (
          <Filtros clase="de-a-dos" hayFiltro={hayFiltro} onLimpiar={() => { setBusqueda(''); setFiltroEsp(''); setFiltroEstado('todos'); }}>
            <input
              type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="DNI, apellido, nombre o matrícula" aria-label="Buscar médico"
            />
            <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)} aria-label="Filtrar por especialidad">
              <option value="">Especialidad: todas</option>
              {especialidades.map((esp) => <option key={esp.id} value={esp.id}>{esp.nombre}</option>)}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="todos">Estado: todos</option>
              <option value="activos">Solo activos</option>
              <option value="baja">Solo de baja</option>
            </select>
          </Filtros>
        )}
        {medicos.length === 0 ? (
          <p className="suave">Todavía no cargaste médicos.</p>
        ) : filtrados.length === 0 ? (
          <p className="suave"><Search size={14} /> No hay médicos que coincidan con la búsqueda.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Médico</th><th>Especialidad</th><th>Matrícula</th><th>Contacto</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className={m.activo ? '' : 'fila-baja'}>
                    <td>
                      <strong>{m.apellido}, {m.nombre}</strong>
                      <div className="suave">DNI {m.dni}</div>
                      {/* En el celular especialidad y matrícula van acá, en una sola línea */}
                      <div className="solo-celu">{m.especialidad} · Mat. {m.matricula}</div>
                    </td>
                    <td className="solo-compu">{m.especialidad}</td>
                    <td className="solo-compu">{m.matricula}</td>
                    <td className={m.email || m.telefono ? '' : 'solo-compu'}>{m.email || '-'}<div className="suave">{m.telefono || ''}</div></td>
                    <td><span className={`etiqueta ${m.activo ? 'activo' : 'baja'}`}>{m.activo ? 'Activo' : 'De baja'}</span></td>
                    <td>
                      <div className="acciones-fila">
                        <button className="boton-chico" onClick={() => editar(m)}><Pencil size={14} /> Editar</button>
                        <button className="boton-chico" onClick={() => cambiarEstado(m)}>
                          {m.activo ? <><UserX size={14} /> Dar de baja</> : <><UserCheck size={14} /> Reactivar</>}
                        </button>
                        <button className="boton-chico" onClick={() => nuevaClave(m)}><KeyRound size={14} /> Nueva clave</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Especialidades lista={especialidades} onCambio={recargar} />
    </>
  );
}