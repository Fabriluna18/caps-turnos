import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import BuscadorMedico from '../components/BuscadorMedico';
import Encabezado from '../components/Encabezado';
import Feriados from '../components/Feriados';
import HorariosSemanales from '../components/HorariosSemanales';
import Licencias from '../components/Licencias';

export default function Horarios() {
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [medico, setMedico] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e.filter((x) => x.activa));
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  return (
    <>
      <Encabezado
        titulo="Horarios de atención"
        subtitulo="Elegí un médico para ver y cambiar sus horarios semanales y sus licencias. Abajo, los feriados del CAPS."
      />
      {error && <p className="error" role="alert">{error}</p>}

      {cargado && medicos.length === 0 && !error && (
        <p className="suave">Primero cargá médicos en la sección Médicos.</p>
      )}

      {medicos.length > 0 && (
        <div className="panel">
          <h2>Médico</h2>
          {!medico && <p className="panel-subtitulo">Buscalo por nombre o filtrá por especialidad.</p>}
          {medico ? (
            <div className="seleccion">
              <div>
                <strong>{medico.apellido}, {medico.nombre}</strong>
                <div className="suave">{medico.especialidad}{medico.activo ? '' : ' · De baja'}</div>
              </div>
              <button className="boton-chico" onClick={() => setMedico(null)}>Cambiar médico</button>
            </div>
          ) : (
            <BuscadorMedico medicos={medicos} especialidades={especialidades} onElegir={setMedico} />
          )}
        </div>
      )}

      {medico && (
        <>
          <HorariosSemanales key={`h-${medico.id}`} medicoId={medico.id} />
          <Licencias key={`l-${medico.id}`} medicoId={medico.id} />
        </>
      )}

      <Feriados />
    </>
  );
}