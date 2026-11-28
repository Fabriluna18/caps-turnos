import { useEffect, useState } from 'react';
import { Eye, KeyRound, Pencil, Search, UserCheck, UserPlus, UserX } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import ClaveTemporal from '../components/ClaveTemporal';
import Encabezado from '../components/Encabezado';
import Filtros from '../components/Filtros';
import VentanaFlotante from '../components/VentanaFlotante';
import { edad, formatoFecha, hoyISO } from '../fechas';

const VACIO = {
  dni: '', nombre: '', apellido: '', fecha_nacimiento: '', telefono: '',
  email: '', direccion: '', localidad: '', cobertura: '',
};

export default function Pacientes() {
  const [datos, setDatos] = useState({ total: 0, pagina: 1, por_pagina: 15, items: [] });
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [cobertura, setCobertura] = useState('');
  const [edadF, setEdadF] = useState('');
  const [email, setEmail] = useState('');
  const [coberturas, setCoberturas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState(VACIO);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [clave, setClave] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // No se muestra a nadie hasta que se busca por nombre, apellido o DNI (mínimo 2 caracteres)
  const hayBusqueda = busqueda.trim().length >= 2;

  // Busca al escribir (esperando un instante) y descarta respuestas viejas
  useEffect(() => {
    if (!hayBusqueda) return undefined;
    let vigente = true;
    const espera = setTimeout(
      () => {
        const params = new URLSearchParams({ q: busqueda.trim(), estado, pagina: String(pagina) });
        if (cobertura) params.set('cobertura', cobertura);
        if (edadF) params.set('edad', edadF);
        if (email) params.set('email', email);
        apiFetch(`/pacientes?${params}`)
          .then((r) => {
            if (vigente) setDatos(r);
          })
          .catch((err) => {
            if (vigente) setError(mensajeDeError(err));
          })
          .finally(() => {
            if (vigente) setCargado(true);
          });
      },
      300
    );
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [hayBusqueda, busqueda, estado, cobertura, edadF, email, pagina, version]);

  // Las coberturas cargadas, para el desplegable del filtro
  useEffect(() => {
    apiFetch('/pacientes/coberturas').then(setCoberturas).catch(() => setCoberturas([]));
  }, []);

  const hayExtra = Boolean(estado !== 'todos' || cobertura || edadF || email);
  const cambiarFiltro = (set) => (e) => {
    set(e.target.value);
    setPagina(1);
  };
  const limpiarFiltros = () => {
    setBusqueda('');
    setEstado('todos');
    setCobertura('');
    setEdadF('');
    setEmail('');
    setPagina(1);
  };

  const recargar = () => setVersion((v) => v + 1);
  const limpiarMensajes = () => {
    setError('');
    setOk('');
  };

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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

  const editar = (p) => {
    limpiarMensajes();
    setClave(null);
    setFicha(null);
    setEditando(p.id);
    setForm({
      dni: p.dni,
      nombre: p.nombre,
      apellido: p.apellido,
      fecha_nacimiento: p.fecha_nacimiento || '',
      telefono: p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
      localidad: p.localidad || '',
      cobertura: p.cobertura || '',
    });
    setFormAbierto(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    limpiarMensajes();
    setClave(null);
    setGuardando(true);
    try {
      if (editando) {
        await apiFetch(`/pacientes/${editando}`, { method: 'PUT', body: JSON.stringify(form) });
        cerrarFormulario();
        setOk('Datos actualizados');
      } else {
        const r = await apiFetch('/pacientes', { method: 'POST', body: JSON.stringify(form) });
        cerrarFormulario();
        setClave({ nombre: `${r.paciente.nombre} ${r.paciente.apellido}`, valor: r.clave_temporal });
        // Se muestra al recién cargado buscándolo por su DNI (sin otros filtros que lo escondan)
        limpiarFiltros();
        setBusqueda(String(r.paciente.dni || form.dni));
      }
      recargar();
    } catch (err) {
      setError(mensajeDeError(err)); // se muestra dentro de la ventana, que queda abierta
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (p) => {
    limpiarMensajes();
    setFicha(null);
    try {
      await apiFetch(`/pacientes/${p.id}/estado`, { method: 'PUT', body: JSON.stringify({ activo: !p.activo }) });
      setOk(`${p.nombre} ${p.apellido} ${p.activo ? 'quedó dado de baja' : 'fue reactivado'}`);
      recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const nuevaClave = async (p) => {
    if (!window.confirm(`¿Generar una clave temporal nueva para ${p.nombre} ${p.apellido}? La anterior deja de funcionar.`)) return;
    limpiarMensajes();
    setFicha(null);
    try {
      const r = await apiFetch(`/pacientes/${p.id}/reset-clave`, { method: 'POST' });
      setClave({ nombre: `${p.nombre} ${p.apellido}`, valor: r.clave_temporal });
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(datos.total / datos.por_pagina));
  const desde = datos.total === 0 ? 0 : (datos.pagina - 1) * datos.por_pagina + 1;
  const hasta = Math.min(datos.total, datos.pagina * datos.por_pagina);

  return (
    <>
      <Encabezado titulo="Pacientes" subtitulo="Buscá a una persona para ver o corregir sus datos, darla de baja o generarle una clave nueva.">
        <button className="boton" onClick={nuevo}><UserPlus size={18} /> Nuevo paciente</button>
      </Encabezado>
      {error && !formAbierto && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {clave && <ClaveTemporal nombre={clave.nombre} valor={clave.valor} onCerrar={() => setClave(null)} />}

      {ficha && (
        <VentanaFlotante titulo={`${ficha.apellido}, ${ficha.nombre}`} onCerrar={() => setFicha(null)}>
          <dl className="datos">
            <div><dt>DNI</dt><dd>{ficha.dni}</dd></div>
            <div>
              <dt>Fecha de nacimiento</dt>
              <dd>
                {ficha.fecha_nacimiento
                  ? `${formatoFecha(ficha.fecha_nacimiento)} (${edad(ficha.fecha_nacimiento)} años)`
                  : 'No cargada'}
              </dd>
            </div>
            <div><dt>Teléfono</dt><dd>{ficha.telefono || '-'}</dd></div>
            <div><dt>Email</dt><dd>{ficha.email || 'Sin email: no recibe recordatorios por mail'}</dd></div>
            <div><dt>Dirección</dt><dd>{ficha.direccion || '-'}</dd></div>
            <div><dt>Localidad</dt><dd>{ficha.localidad || '-'}</dd></div>
            <div><dt>Cobertura</dt><dd>{ficha.cobertura || '-'}</dd></div>
            <div><dt>Estado</dt><dd>{ficha.activo ? 'Activo' : 'De baja'}</dd></div>
          </dl>
          <div className="acciones">
            <button className="boton-chico" onClick={() => editar(ficha)}><Pencil size={14} /> Editar</button>
            <button className="boton-chico" onClick={() => cambiarEstado(ficha)}>
              {ficha.activo ? <><UserX size={14} /> Dar de baja</> : <><UserCheck size={14} /> Reactivar</>}
            </button>
            <button className="boton-chico" onClick={() => nuevaClave(ficha)}><KeyRound size={14} /> Nueva clave</button>
          </div>
        </VentanaFlotante>
      )}

      {formAbierto && (
        <VentanaFlotante titulo={editando ? 'Editar paciente' : 'Nuevo paciente'} onCerrar={cerrarFormulario}>
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
                Fecha de nacimiento
                <input
                  name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={cambiar}
                  min="1900-01-01" max={hoyISO()} required
                />
              </label>
              <label className="campo">
                Teléfono (opcional)
                <input name="telefono" value={form.telefono} onChange={cambiar} maxLength={30} />
              </label>
              <label className="campo">
                Email (opcional)
                <input name="email" type="email" value={form.email} onChange={cambiar} maxLength={150} />
              </label>
              <label className="campo">
                Dirección (opcional)
                <input name="direccion" value={form.direccion} onChange={cambiar} maxLength={150} />
              </label>
              <label className="campo">
                Localidad (opcional)
                <input name="localidad" value={form.localidad} onChange={cambiar} maxLength={80} />
              </label>
              <label className="campo">
                Cobertura (opcional)
                <input name="cobertura" list="coberturas" value={form.cobertura} onChange={cambiar} maxLength={80} />
                <datalist id="coberturas">
                  <option value="Sin cobertura" />
                  <option value="PAMI" />
                  <option value="Obra social" />
                  <option value="Prepaga" />
                </datalist>
              </label>
            </div>
            <div className="acciones">
              <button className="boton" type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar paciente'}
              </button>
              <button className="boton secundario" type="button" onClick={cerrarFormulario}>Cancelar</button>
            </div>
          </form>
        </VentanaFlotante>
      )}

      <div className="panel">
        <h2>Pacientes registrados</h2>
        <p className="panel-subtitulo">
          {hayBusqueda && cargado ? `${datos.total} resultado${datos.total === 1 ? '' : 's'}` : 'Por privacidad, no se muestra a nadie hasta que buscás.'}
        </p>
        <Filtros clase="de-a-dos" hayFiltro={Boolean(busqueda || hayExtra)} onLimpiar={limpiarFiltros}>
          <input
            type="search" value={busqueda} placeholder="Buscar por DNI, apellido o nombre"
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            aria-label="Buscar paciente"
          />
          <select value={estado} aria-label="Filtrar por estado" onChange={cambiarFiltro(setEstado)}>
            <option value="todos">Estado: todos</option>
            <option value="activos">Solo activos</option>
            <option value="baja">Solo de baja</option>
          </select>
          <select value={cobertura} aria-label="Filtrar por cobertura" onChange={cambiarFiltro(setCobertura)}>
            <option value="">Cobertura: todas</option>
            <option value="sin">Sin cobertura</option>
            {coberturas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={edadF} aria-label="Filtrar por edad" onChange={cambiarFiltro(setEdadF)}>
            <option value="">Edad: todas</option>
            <option value="chicos">Menores de 18</option>
            <option value="adultos">De 18 a 64</option>
            <option value="mayores">65 o más</option>
          </select>
          <select value={email} aria-label="Filtrar por email" onChange={cambiarFiltro(setEmail)}>
            <option value="">Email: todos</option>
            <option value="con">Con email (reciben recordatorios)</option>
            <option value="sin">Sin email</option>
          </select>
        </Filtros>

        {!hayBusqueda ? (
          <p className="suave">
            <Search size={14} /> Escribí el DNI, el apellido o el nombre del paciente para ver sus datos.
          </p>
        ) : !cargado ? (
          <p className="suave">Cargando...</p>
        ) : datos.items.length === 0 ? (
          <p className="suave">
            <Search size={14} /> No hay pacientes que coincidan con la búsqueda.
          </p>
        ) : (
          <>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Paciente</th><th>Edad</th><th>Contacto</th><th>Cobertura</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {datos.items.map((p) => (
                    <tr key={p.id} className={p.activo ? '' : 'fila-baja'}>
                      <td>
                        <strong>{p.apellido}, {p.nombre}</strong>
                        <div className="suave">
                          DNI {p.dni}
                          {/* En el celular la edad va acá, en lugar de su propia columna */}
                          {p.fecha_nacimiento && <span className="solo-celu"> · {edad(p.fecha_nacimiento)} años</span>}
                        </div>
                      </td>
                      <td className="solo-compu">{p.fecha_nacimiento ? `${edad(p.fecha_nacimiento)} años` : '-'}</td>
                      <td>{p.telefono || '-'}<div className="suave">{p.email || 'Sin email'}</div></td>
                      <td className="solo-compu">{p.cobertura || '-'}</td>
                      <td className="en-linea-celu"><span className={`etiqueta ${p.activo ? 'activo' : 'baja'}`}>{p.activo ? 'Activo' : 'De baja'}</span></td>
                      <td className="en-linea-celu">
                        <div className="acciones-fila">
                          <button className="boton-chico" onClick={() => setFicha(p)}><Eye size={14} /> Ver ficha</button>
                          {/* En celular y tableta estas tres están dentro de "Ver ficha" */}
                          <button className="boton-chico solo-compu" onClick={() => editar(p)}><Pencil size={14} /> Editar</button>
                          <button className="boton-chico solo-compu" onClick={() => cambiarEstado(p)}>
                            {p.activo ? <><UserX size={14} /> Dar de baja</> : <><UserCheck size={14} /> Reactivar</>}
                          </button>
                          <button className="boton-chico solo-compu" onClick={() => nuevaClave(p)}><KeyRound size={14} /> Nueva clave</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="paginacion">
              <span className="suave">Mostrando {desde} a {hasta} de {datos.total}</span>
              <div className="botones">
                <button className="boton-chico" disabled={datos.pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                <span className="suave">Página {datos.pagina} de {totalPaginas}</span>
                <button className="boton-chico" disabled={datos.pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
