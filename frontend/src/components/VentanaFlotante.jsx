import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Ventana flotante sobre la pantalla (usa el <dialog> del navegador).
// Se cierra con el botón, con la tecla Esc o tocando afuera.
export default function VentanaFlotante({ titulo, onCerrar, children }) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const ventana = ref.current;
    if (!ventana.open) ventana.showModal();
    return () => ventana.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="ventana"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault(); // la cierra React, no el navegador
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar(); // tocó el fondo oscuro, no la ventana
      }}
    >
      <div className="ventana-cuerpo">
        <div className="ficha-cab">
          <h2 id={idTitulo}>{titulo}</h2>
          <button className="boton-chico" type="button" onClick={onCerrar}><X size={14} /> Cerrar</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
