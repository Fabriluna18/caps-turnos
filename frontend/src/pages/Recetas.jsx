import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';
import { formatoFecha } from '../fechas';

// La usan el médico ("Recetas", con buscador) y el paciente ("Mis recetas")
export default function Recetas() {
  const esMedico = usuarioActual()?.rol === 'medico';
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (q) params.set('q', q);
    apiFetch(`/recetas?${params}`)
      .then((r) => {
        setDatos(r);
        setError('');
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [q, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const buscar = (e) => {
    e.preventDefault();
    setPagina(1);
    setQ(texto.trim());
  };

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <>
      <h1>{esMedico ? 'Recetas' : 'Mis recetas'}</h1>
      <p className="suave">
        {esMedico
          ? 'Las recetas que emitiste. Para hacer una nueva, entrá a la Agenda del día y tocá "Receta" en el turno.'
          : 'Las recetas que te hicieron tus médicos. Podés verlas e imprimirlas.'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      {esMedico && (
        <form className="filtros" onSubmit={buscar}>
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por apellido, nombre o DNI del paciente" aria-label="Buscar paciente" />
          <button className="boton-chico">Buscar</button>
        </form>
      )}

      {!datos && !error && <p className="suave">Cargando...</p>}
      {datos && datos.items.length === 0 && (
        <p className="suave">{q ? 'No hay recetas para esa búsqueda.' : 'Todavía no hay recetas.'}</p>
      )}

      {datos && datos.items.length > 0 && (
        <div className="panel">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>{esMedico ? 'Paciente' : 'Médico'}</th><th>Medicamentos</th><th /></tr>
            </thead>
            <tbody>
              {datos.items.map((r) => (
                <tr key={r.id} style={r.anulada ? { opacity: 0.6 } : undefined}>
                  <td><strong>{formatoFecha(r.fecha)}</strong><div className="suave">N° {r.id}</div></td>
                  <td>
                    {esMedico ? (
                      <>{r.paciente.apellido}, {r.paciente.nombre}<div className="suave">DNI {r.paciente.dni}</div></>
                    ) : (
                      <>{r.medico.apellido}, {r.medico.nombre}<div className="suave">{r.medico.especialidad}</div></>
                    )}
                  </td>
                  <td>
                    {r.medicamentos}
                    {r.anulada && <div><span className="estado cancelado">Anulada</span></div>}
                  </td>
                  <td>
                    <a className="boton-chico" href={`/receta/${r.id}`} target="_blank" rel="noopener noreferrer">Ver / imprimir</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginas > 1 && (
            <div className="acciones">
              <button className="boton-chico" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
              <span className="suave">Página {pagina} de {paginas}</span>
              <button className="boton-chico" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
