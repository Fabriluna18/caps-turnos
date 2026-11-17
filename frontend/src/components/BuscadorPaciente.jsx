import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

// No muestra ningún paciente hasta que se escribe al menos 2 letras o números
export default function BuscadorPaciente({ onElegir }) {
  const [texto, setTexto] = useState('');
  const [datos, setDatos] = useState({ consulta: '', items: [] });
  const [error, setError] = useState('');
  const q = texto.trim();
  const listo = q.length >= 2;

  useEffect(() => {
    if (!listo) return;
    let vigente = true;
    const espera = setTimeout(() => {
      const params = new URLSearchParams({ q, estado: 'activos', pagina: '1' });
      apiFetch(`/pacientes?${params}`)
        .then((r) => {
          if (!vigente) return;
          setDatos({ consulta: q, items: r.items.slice(0, 8) });
          setError('');
        })
        .catch((err) => {
          if (vigente) setError(mensajeDeError(err));
        });
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [q, listo]);

  const hayResultados = listo && datos.consulta === q;

  return (
    <div>
      <input
        type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar paciente por apellido, nombre o DNI" aria-label="Buscar paciente"
        className="buscador"
      />
      {error && <p className="error" role="alert">{error}</p>}
      {!listo ? (
        <p className="suave">Escribí al menos 2 letras o números para buscar.</p>
      ) : !hayResultados ? (
        <p className="suave">Buscando...</p>
      ) : datos.items.length === 0 ? (
        <p className="suave">No se encontró ningún paciente activo con ese dato.</p>
      ) : (
        <ul className="resultados">
          {datos.items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onElegir(p)}>
                <span><strong>{p.apellido}, {p.nombre}</strong> <span className="suave">DNI {p.dni}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}