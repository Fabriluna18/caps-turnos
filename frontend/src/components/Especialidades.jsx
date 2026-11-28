import { useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Filtros from './Filtros';

export default function Especialidades({ lista, onCambio }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('todas');
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const limpiar = () => {
    setError('');
    setOk('');
  };

  const agregar = async (e) => {
    e.preventDefault();
    limpiar();
    try {
      await apiFetch('/especialidades', { method: 'POST', body: JSON.stringify({ nombre }) });
      setNombre('');
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const abrirEdicion = (esp) => {
    limpiar();
    setEditando(esp);
    setNombreEdicion(esp.nombre);
  };

  const guardarNombre = async (e) => {
    e.preventDefault();
    limpiar();
    try {
      await apiFetch(`/especialidades/${editando.id}`, { method: 'PUT', body: JSON.stringify({ nombre: nombreEdicion }) });
      setEditando(null);
      setOk('Nombre actualizado');
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarEstado = async () => {
    limpiar();
    try {
      await apiFetch(`/especialidades/${editando.id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activa: !editando.activa }),
      });
      setOk(editando.activa ? 'Especialidad desactivada' : 'Especialidad reactivada');
      setEditando(null);
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Borrar la especialidad "${editando.nombre}"? Solo se puede si ningún médico la usó nunca.`)) return;
    limpiar();
    try {
      await apiFetch(`/especialidades/${editando.id}`, { method: 'DELETE' });
      setEditando(null);
      setOk('Especialidad eliminada');
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const q = texto.trim().toLowerCase();
  const visibles = lista.filter((esp) => {
    if (estado === 'activas' && !esp.activa) return false;
    if (estado === 'inactivas' && esp.activa) return false;
    return !q || esp.nombre.toLowerCase().includes(q);
  });
  const hayFiltro = Boolean(q || estado !== 'todas');

  return (
    <div className="panel">
      <h2>Especialidades</h2>
      <p className="panel-subtitulo">
        Con <strong>Editar</strong> corregís el nombre, la desactivás o la borrás. Borrarla solo se puede si ningún médico
        la usó nunca. El número indica cuántos médicos activos la tienen.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {lista.length > 4 && (
        <Filtros clase="de-a-dos" hayFiltro={hayFiltro} onLimpiar={() => { setTexto(''); setEstado('todas'); }}>
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar especialidad" aria-label="Buscar especialidad" />
          <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
            <option value="todas">Estado: todas</option>
            <option value="activas">Solo activas</option>
            <option value="inactivas">Solo desactivadas</option>
          </select>
        </Filtros>
      )}
      {visibles.length === 0 && <p className="suave">No hay especialidades que coincidan.</p>}

      <ul className="chips">
        {visibles.map((esp) => (
          <li key={esp.id} className={esp.activa ? '' : 'inactiva'}>
            {esp.nombre} <small>({esp.medicos})</small>
            <button type="button" className="chip-accion" onClick={() => abrirEdicion(esp)}>Editar</button>
          </li>
        ))}
      </ul>

      {editando && (
        <div className="panel-edicion">
          <strong>Editar «{editando.nombre}»</strong>
          <form className="fila-form" onSubmit={guardarNombre}>
            <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} maxLength={60} required />
            <button className="boton" type="submit">Guardar nombre</button>
          </form>
          <div className="acciones" style={{ marginTop: 0 }}>
            <button type="button" className="boton-chico" onClick={cambiarEstado}>
              {editando.activa ? 'Desactivar' : 'Reactivar'}
            </button>
            <button type="button" className="boton-chico peligro" onClick={eliminar}>Borrar</button>
            <button type="button" className="boton-chico" onClick={() => setEditando(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <h3>Agregar especialidad</h3>
      <form className="fila-form" onSubmit={agregar}>
        <input
          value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva especialidad" maxLength={60} required
        />
        <button className="boton" type="submit">Agregar</button>
      </form>
    </div>
  );
}