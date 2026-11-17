import { useState } from 'react';

const normalizar = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// No muestra ningún médico hasta que se busca: escribiendo al menos 2 letras o eligiendo una especialidad
export default function BuscadorMedico({ medicos, especialidades = [], onElegir }) {
  const [texto, setTexto] = useState('');
  const [especialidad, setEspecialidad] = useState('');

  const q = normalizar(texto.trim());
  const buscando = q.length >= 2 || especialidad !== '';

  const resultados = !buscando
    ? []
    : medicos
        .filter((m) => {
          if (especialidad && String(m.especialidad_id) !== especialidad) return false;
          if (q.length < 2) return true;
          return normalizar(`${m.apellido} ${m.nombre} ${m.especialidad}`).includes(q);
        })
        .slice(0, 12);

  return (
    <div>
      <div className="filtros">
        <input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar médico por apellido, nombre o especialidad" aria-label="Buscar médico"
        />
        {especialidades.length > 0 && (
          <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} aria-label="Especialidad">
            <option value="">Todas las especialidades</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {!buscando ? (
        <p className="suave">Escribí al menos 2 letras o elegí una especialidad para ver médicos.</p>
      ) : resultados.length === 0 ? (
        <p className="suave">No se encontró ningún médico.</p>
      ) : (
        <ul className="resultados">
          {resultados.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onElegir(m)}>
                <span><strong>{m.apellido}, {m.nombre}</strong> <span className="suave">{m.especialidad}</span></span>
                {m.activo === false && <span className="etiqueta baja">De baja</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}