import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import CalendarioDisponibilidad from '../components/CalendarioDisponibilidad';
import HorariosDelDia from '../components/HorariosDelDia';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Turnos() {
  const [especialidades, setEspecialidades] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [especialidadId, setEspecialidadId] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [fecha, setFecha] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/especialidades'), apiFetch('/disponibilidad/medicos')])
      .then(([esp, med]) => {
        setEspecialidades(esp);
        setMedicos(med);
        if (med[0]) setMedicoId(String(med[0].id));
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  const visibles = medicos.filter((m) => !especialidadId || String(m.especialidad_id) === especialidadId);
  const medico = medicos.find((m) => String(m.id) === medicoId);

  const elegirEspecialidad = (valor) => {
    setEspecialidadId(valor);
    const lista = medicos.filter((m) => !valor || String(m.especialidad_id) === valor);
    setMedicoId(lista[0] ? String(lista[0].id) : '');
    setFecha(null);
  };

  const elegirMedico = (valor) => {
    setMedicoId(valor);
    setFecha(null);
  };

  return (
    <>
      <h1>Turnos</h1>
      {error && <p className="error" role="alert">{error}</p>}

      {cargado && medicos.length === 0 && !error && (
        <p className="suave">No hay médicos activos. Cargalos en la sección Médicos y sus horarios en Horarios.</p>
      )}

      {medicos.length > 0 && (
        <>
          <div className="filtros">
            <select value={especialidadId} onChange={(e) => elegirEspecialidad(e.target.value)} aria-label="Especialidad">
              <option value="">Todas las especialidades</option>
              {especialidades.filter((e) => e.activa).map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            <select value={medicoId} onChange={(e) => elegirMedico(e.target.value)} aria-label="Médico">
              {visibles.length === 0 && <option value="">No hay médicos en esa especialidad</option>}
              {visibles.map((m) => (
                <option key={m.id} value={m.id}>{m.apellido}, {m.nombre} - {m.especialidad}</option>
              ))}
            </select>
          </div>

          {medico && (
            <p className="suave">
              {medico.dias.length === 0
                ? 'Este médico todavía no tiene horarios cargados.'
                : `Atiende: ${medico.dias.map((d) => DIAS[d - 1]).join(', ')}.`}
            </p>
          )}

          {medicoId && (
            <div className="dos-columnas">
              <CalendarioDisponibilidad medicoId={medicoId} fechaElegida={fecha} onElegir={setFecha} />
              <HorariosDelDia medicoId={medicoId} fecha={fecha} />
            </div>
          )}

          <p className="suave" style={{ marginTop: 16 }}>
            Por ahora podés consultar la disponibilidad. Reservar turnos se habilita el Día 8.
          </p>
        </>
      )}
    </>
  );
}