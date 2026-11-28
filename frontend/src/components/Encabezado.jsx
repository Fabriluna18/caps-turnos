// Encabezado de cada pantalla: título, subtítulo y botones, cada cosa en su renglón
// (pedido de la ingeniera: "que no esté nada junto, todo separado").
export default function Encabezado({ titulo, subtitulo, children }) {
  return (
    <header className="encabezado">
      <h1>{titulo}</h1>
      {subtitulo && <p className="encabezado-subtitulo">{subtitulo}</p>}
      {children && <div className="encabezado-acciones">{children}</div>}
    </header>
  );
}
