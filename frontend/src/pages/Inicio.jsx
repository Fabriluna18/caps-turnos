import { useState } from 'react';
import { apiFetch } from '../api/client';
import { usuarioActual } from '../auth';

const TEXTOS = {
  secretaria: 'Desde acá vas a gestionar médicos, pacientes, turnos y reportes.',
  medico: 'Desde acá vas a ver tu agenda del día y generar recetas.',
  paciente: 'Desde acá vas a poder ver los médicos y sacar tus turnos.',
};

export default function Inicio() {
  const usuario = usuarioActual();
  const [prueba, setPrueba] = useState('');

  // Prueba temporal del control de permisos (la sacamos más adelante)
  const probarPermiso = async () => {
    try {
      const r = await apiFetch('/auth/prueba-secretaria');
      setPrueba(r.mensaje);
    } catch (err) {
      setPrueba(err.message);
    }
  };

  return (
    <>
      <h1>Hola, {usuario.nombre}</h1>
      <p className="suave">{TEXTOS[usuario.rol]}</p>
      <div className="panel-prueba">
        <button className="boton secundario" onClick={probarPermiso}>Probar permiso de secretaría</button>
        {prueba && <p className="suave" style={{ marginTop: 12 }}>{prueba}</p>}
      </div>
    </>
  );
}