import { SlidersHorizontal, X } from 'lucide-react';

// Caja de filtros, igual en todas las pantallas: título "Filtrar", los campos
// y un botón "Limpiar filtros" que aparece solo cuando hay alguno puesto.
// clase: clases extra para la fila de campos (ej. 'de-a-dos').
export default function Filtros({ children, hayFiltro = false, onLimpiar, clase = '', onSubmit }) {
  const Contenedor = onSubmit ? 'form' : 'div';
  return (
    <Contenedor className="caja-filtros" onSubmit={onSubmit}>
      <div className="caja-filtros-cab">
        <span><SlidersHorizontal size={15} /> Filtrar</span>
        {hayFiltro && onLimpiar && (
          <button type="button" className="limpiar-filtros" onClick={onLimpiar}>
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>
      <div className={`filtros ${clase}`}>{children}</div>
    </Contenedor>
  );
}
