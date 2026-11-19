import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

const CAMPOS = [
  ['enfermedades', 'Enfermedades'],
  ['medicacion', 'Medicación habitual'],
  ['antecedentes_personales', 'Antecedentes personales'],
  ['antecedentes_familiares', 'Antecedentes familiares'],
];

// El paciente ve su ficha, sin poder cambiarla
export default function MiFicha() {
  const [ficha, setFicha] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/paciente/ficha')
      .then((r) => setFicha(r.ficha))
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  return (
    <>
      <h1>Mi ficha</h1>
      <p className="suave">Lo que cargaron tus médicos. Si algo no es correcto, avisale en tu próxima consulta.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {ficha === undefined && !error && <p className="suave">Cargando...</p>}
      {ficha === null && <p className="suave">Todavía no tenés una ficha cargada.</p>}
      {ficha && (
        <div className="panel">
          {ficha.alergias && (
            <p className="error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={16} /> <strong>Alergias:</strong> {ficha.alergias}
            </p>
          )}
          <dl className="datos">
            <div><dt>Grupo sanguíneo</dt><dd>{ficha.grupo_sanguineo || '—'}</dd></div>
            {!ficha.alergias && <div><dt>Alergias</dt><dd>Ninguna registrada</dd></div>}
            {CAMPOS.map(([id, texto]) => (
              <div key={id}><dt>{texto}</dt><dd style={{ whiteSpace: 'pre-line' }}>{ficha[id] || '—'}</dd></div>
            ))}
          </dl>
          <p className="leyenda">Actualizada por {ficha.actualizado_por}.</p>
        </div>
      )}
    </>
  );
}
