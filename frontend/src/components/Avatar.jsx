const COLORES = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];

export default function Avatar({ nombre, apellido, tamano = 48 }) {
  const iniciales = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
  const suma = [...`${nombre}${apellido}`].reduce((s, c) => s + c.charCodeAt(0), 0);

  return (
    <div
      className="avatar"
      aria-hidden="true"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.38, background: COLORES[suma % COLORES.length] }}
    >
      {iniciales}
    </div>
  );
}