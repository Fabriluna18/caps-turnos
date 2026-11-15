import { useState } from 'react';

export default function ClaveTemporal({ nombre, valor, onCerrar }) {
  const [copiada, setCopiada] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      // sin permiso del navegador: se copia a mano
    }
  };

  return (
    <div className="clave-temporal" role="status">
      <strong>Clave temporal de {nombre}</strong>
      <code>{valor}</code>
      <p className="suave">
        Anotala y entregásela en persona: no se vuelve a mostrar. La va a tener que cambiar en su primer ingreso.
      </p>
      <div className="acciones">
        <button className="boton secundario" onClick={copiar}>{copiada ? 'Copiada ✓' : 'Copiar'}</button>
        <button className="boton secundario" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}