import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import FichaClinica from '../components/FichaClinica';
import { edad, formatoFecha } from '../fechas';

// Mis pacientes: no muestra a nadie hasta que se busca (o se pide ver todos)
export default function PacientesMedico() {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState(null); // null = todavía no se buscó
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState('');

  const cargar = async (q, p) => {
    setError('');
    setElegido(null);
    try {
      const params = new URLSearchParams({ pagina: String(p) });
      if (q) params.set('q', q);
      setDatos(await apiFetch(`/medico/pacientes?${params}`));
      setBusqueda(q);
      setPagina(p);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const buscar = (e) => {
    e.preventDefault();
    const q = texto.trim();
    if (q.length < 2) {
      setError('Escribí al menos 2 letras o números para buscar');
      return;
    }
    cargar(q, 1);
  };

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <>
      <h1>Pacientes</h1>
      <p className="suave">Las personas que tienen o tuvieron un turno con vos. Buscalas para ver o cargar su ficha clínica.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <form className="filtros" onSubmit={buscar}>
        <input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Apellido, nombre o DNI" aria-label="Buscar paciente"
        />
        <button className="boton-chico">Buscar</button>
        <button type="button" className="boton-chico secundario" onClick={() => { setTexto(''); cargar('', 1); }}>
          Ver todos
        </button>
      </form>

      {busqueda !== null && datos && datos.items.length === 0 && (
        <p className="suave">{busqueda ? 'No encontramos pacientes con esa búsqueda.' : 'Todavía no tenés pacientes.'}</p>
      )}

      {datos && datos.items.length > 0 && !elegido && (
        <div className="panel">
          <table className="tabla">
            <thead><tr><th>Paciente</th><th>Última consulta</th><th /></tr></thead>
            <tbody>
              {datos.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.apellido}, {p.nombre}</strong>
                    <div className="suave">
                      DNI {p.dni}{p.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''}
                    </div>
                    {p.alergias && (
                      <div className="error" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 8px', marginTop: 4 }}>
                        <AlertTriangle size={12} /> Alergias: {p.alergias}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.ultima_consulta ? formatoFecha(p.ultima_consulta) : <span className="suave">Sin consultas aún</span>}
                    <div className="suave">{p.consultas} consulta{p.consultas === 1 ? '' : 's'}</div>
                  </td>
                  <td><button className="boton-chico" onClick={() => setElegido(p.id)}>Ver ficha</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginas > 1 && (
            <div className="acciones">
              <button className="boton-chico" disabled={pagina <= 1} onClick={() => cargar(busqueda, pagina - 1)}>Anterior</button>
              <span className="suave">Página {pagina} de {paginas}</span>
              <button className="boton-chico" disabled={pagina >= paginas} onClick={() => cargar(busqueda, pagina + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}

      {elegido && <FichaClinica key={elegido} pacienteId={elegido} onCerrar={() => setElegido(null)} />}
    </>
  );
}
