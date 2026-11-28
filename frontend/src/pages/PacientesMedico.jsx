import { useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import Encabezado from '../components/Encabezado';
import FichaClinica from '../components/FichaClinica';
import Filtros from '../components/Filtros';
import { edad, formatoFecha } from '../fechas';

const EXTRAS_VACIOS = { edad: '', alergias: false, atendidos: false, orden: 'apellido' };

// Mis pacientes: no muestra a nadie hasta que se busca (o se pide ver todos)
export default function PacientesMedico() {
  const [texto, setTexto] = useState('');
  const [extras, setExtras] = useState(EXTRAS_VACIOS);
  const [busqueda, setBusqueda] = useState(null); // null = todavía no se buscó
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState('');

  const cargar = async (q, p, ex = extras) => {
    setError('');
    setElegido(null);
    try {
      const params = new URLSearchParams({ pagina: String(p), orden: ex.orden });
      if (q) params.set('q', q);
      if (ex.edad) params.set('edad', ex.edad);
      if (ex.alergias) params.set('alergias', '1');
      if (ex.atendidos) params.set('atendidos', '1');
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
      setError('Escribí al menos 2 letras o números para buscar, o tocá "Ver todos"');
      return;
    }
    cargar(q, 1);
  };

  // Si ya hay una lista a la vista, los filtros extra la actualizan enseguida
  const cambiarExtra = (campo, valor) => {
    const nuevos = { ...extras, [campo]: valor };
    setExtras(nuevos);
    if (busqueda !== null) cargar(busqueda, 1, nuevos);
  };

  const limpiar = () => {
    setTexto('');
    setExtras(EXTRAS_VACIOS);
    setBusqueda(null);
    setDatos(null);
  };

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const hayFiltro = Boolean(texto || extras.edad || extras.alergias || extras.atendidos || extras.orden !== 'apellido' || busqueda !== null);

  return (
    <>
      <Encabezado
        titulo="Pacientes"
        subtitulo="Las personas que tienen o tuvieron un turno con vos. Buscalas para ver o cargar su ficha clínica."
      />
      {error && <p className="error" role="alert">{error}</p>}

      <Filtros clase="de-a-dos" onSubmit={buscar} hayFiltro={hayFiltro} onLimpiar={limpiar}>
        <input
          type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Apellido, nombre o DNI" aria-label="Buscar paciente"
        />
        <select value={extras.edad} onChange={(e) => cambiarExtra('edad', e.target.value)} aria-label="Edad">
          <option value="">Edad: todas</option>
          <option value="chicos">Menores de 18</option>
          <option value="adultos">De 18 a 64</option>
          <option value="mayores">65 o más</option>
        </select>
        <select value={extras.orden} onChange={(e) => cambiarExtra('orden', e.target.value)} aria-label="Orden">
          <option value="apellido">Orden: A a Z</option>
          <option value="recientes">Orden: recientes</option>
        </select>
        <label className="check-filtro">
          <input type="checkbox" checked={extras.alergias} onChange={(e) => cambiarExtra('alergias', e.target.checked)} />
          Solo con alergias
        </label>
        <label className="check-filtro">
          <input type="checkbox" checked={extras.atendidos} onChange={(e) => cambiarExtra('atendidos', e.target.checked)} />
          Solo los que ya atendí
        </label>
        <button className="boton">Buscar</button>
        <button type="button" className="boton secundario" onClick={() => { setTexto(''); cargar('', 1); }}>
          <Users size={16} /> Ver todos
        </button>
      </Filtros>

      {busqueda === null && <p className="suave">Buscá por nombre o DNI, o tocá "Ver todos" para ver la lista completa.</p>}

      {busqueda !== null && datos && datos.items.length === 0 && (
        <p className="suave">{busqueda || extras.edad || extras.alergias || extras.atendidos ? 'No encontramos pacientes con esa búsqueda.' : 'Todavía no tenés pacientes.'}</p>
      )}

      {datos && datos.items.length > 0 && !elegido && (
        <div className="panel">
          <h2>Resultados</h2>
          <p className="panel-subtitulo">{datos.total} paciente{datos.total === 1 ? '' : 's'}</p>
          <table className="tabla">
            <thead><tr><th>Paciente</th><th>Última consulta</th><th /></tr></thead>
            <tbody>
              {datos.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.apellido}, {p.nombre}</strong>
                    <div className="suave">
                      DNI {p.dni}{p.fecha_nacimiento ? ` · ${edad(p.fecha_nacimiento)} años` : ''}{p.cobertura ? ` · ${p.cobertura}` : ''}
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
