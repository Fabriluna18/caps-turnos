import { useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

export default function Especialidades({ lista, onCambio }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');

  const agregar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/especialidades', { method: 'POST', body: JSON.stringify({ nombre }) });
      setNombre('');
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const cambiarEstado = async (esp) => {
    setError('');
    try {
      await apiFetch(`/especialidades/${esp.id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activa: !esp.activa }),
      });
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <div className="panel">
      <h2>Especialidades</h2>
      <p className="suave" style={{ marginTop: 0 }}>
        Las especialidades no se borran: se desactivan y quedan guardadas. El número indica cuántos médicos activos las tienen.
      </p>
      <ul className="chips">
        {lista.map((esp) => (
          <li key={esp.id} className={esp.activa ? '' : 'inactiva'}>
            {esp.nombre} <small>({esp.medicos})</small>
            <button type="button" className="chip-accion" onClick={() => cambiarEstado(esp)}>
              {esp.activa ? 'Desactivar' : 'Reactivar'}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
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