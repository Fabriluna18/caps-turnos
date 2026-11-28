import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Encabezado from '../components/Encabezado';
import ListaTurnos from '../components/ListaTurnos';
import SacarTurno from '../components/SacarTurno';

export default function Turnos() {
  const [vista, setVista] = useState('sacar');
  const [activos, setActivos] = useState([]);
  const [todos, setTodos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/disponibilidad/medicos'), apiFetch('/medicos'), apiFetch('/especialidades')])
      .then(([a, t, e]) => {
        setActivos(a);
        setTodos(t);
        setEspecialidades(e.filter((x) => x.activa));
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargado(true));
  }, []);

  return (
    <>
      <Encabezado
        titulo="Turnos"
        subtitulo={vista === 'sacar'
          ? 'Reservá un turno: elegí el paciente, el médico, el día y la hora.'
          : 'Buscá turnos ya reservados para confirmarlos, reprogramarlos o cancelarlos.'}
      />
      {error && <p className="error" role="alert">{error}</p>}

      <div className="pestanas">
        <button className={vista === 'sacar' ? 'activa' : ''} onClick={() => setVista('sacar')}>Sacar turno</button>
        <button className={vista === 'lista' ? 'activa' : ''} onClick={() => setVista('lista')}>Turnos reservados</button>
      </div>

      {cargado && vista === 'sacar' && activos.length === 0 && !error && (
        <p className="suave">No hay médicos activos. Cargalos en Médicos y sus horarios en Horarios.</p>
      )}

      {cargado && vista === 'sacar' && activos.length > 0 && (
        <SacarTurno medicos={activos} especialidades={especialidades} />
      )}
      {cargado && vista === 'lista' && <ListaTurnos medicos={todos} especialidades={especialidades} />}
    </>
  );
}