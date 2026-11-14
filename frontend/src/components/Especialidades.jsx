import { useState } from 'react';
import { X } from 'lucide-react';
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

  const borrar = async (esp) => {
    if (!window.confirm(`¿Eliminar la especialidad "${esp.nombre}"?`)) return;
    setError('');
    try {
      await apiFetch(`/especialidades/${esp.id}`, { method: 'DELETE' });
      onCambio();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  return (
    <div className="panel">
      <h2>Especialidades</h2>
      <ul className="chips">
        {lista.map((esp) => (
          <li key={esp.id}>
            {esp.nombre} <small>({esp.medicos})</small>
            <button type="button" onClick={() => borrar(esp)} aria-label={`Eliminar ${esp.nombre}`}>
              <X size={14} />
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