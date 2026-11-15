import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Feriados from '../components/Feriados';
import HorariosSemanales from '../components/HorariosSemanales';
import Licencias from '../components/Licencias';

export default function Horarios() {
  const [medicos, setMedicos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [medicoId, setMedicoId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/medicos')
      .then((lista) => {
        setMedicos(lista);
        const primero = lista.find((m) => m.activo) || lista[0];
        if (primero) setMedicoId(String(primero.id));
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  return (
    <>
      <h1>Horarios de atención</h1>
      {error && <p className="error" role="alert">{error}</p>}

      {cargado && medicos.length === 0 && !error && (
        <p className="suave">Primero cargá médicos en la sección Médicos.</p>
      )}

      {medicos.length > 0 && (
        <>
          <label className="campo selector-medico">
            Médico
            <select value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.apellido}, {m.nombre} - {m.especialidad}{m.activo ? '' : ' (de baja)'}
                </option>
              ))}
            </select>
          </label>

          {medicoId && (
            <>
              <HorariosSemanales key={`h-${medicoId}`} medicoId={medicoId} />
              <Licencias key={`l-${medicoId}`} medicoId={medicoId} />
            </>
          )}
        </>
      )}

      <Feriados />
    </>
  );
}