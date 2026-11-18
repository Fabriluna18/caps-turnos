import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { usuarioActual } from '../auth';
import { edad, formatoFecha } from '../fechas';
import '../receta.css';

export default function RecetaVer() {
  const { id } = useParams();
  const usuario = usuarioActual();
  const [receta, setReceta] = useState(null);
  const [error, setError] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [preguntar, setPreguntar] = useState(false);

  useEffect(() => {
    apiFetch(`/recetas/${id}`)
      .then(setReceta)
      .catch((err) => setError(mensajeDeError(err)));
  }, [id]);

  const anular = async () => {
    setAnulando(true);
    try {
      await apiFetch(`/recetas/${id}/anular`, { method: 'PUT' });
      setReceta(await apiFetch(`/recetas/${id}`));
      setPreguntar(false);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setAnulando(false);
    }
  };

  const volver = usuario?.rol === 'medico' ? '/medico/recetas' : '/paciente/mis-recetas';

  return (
    <div className="rx-fondo">
      <div className="rx-barra rx-no-imprimir">
        <Link className="boton-chico secundario" to={volver}>Volver</Link>
        {receta && (
          <button className="boton-chico" onClick={() => window.print()}>
            <Printer size={14} /> Imprimir
          </button>
        )}
        {receta?.puede_anular && !preguntar && (
          <button className="boton-chico secundario" onClick={() => setPreguntar(true)}>Anular receta</button>
        )}
        {preguntar && (
          <>
            <span>¿Anular esta receta? Queda guardada, marcada como anulada.</span>
            <button className="boton-chico" disabled={anulando} onClick={anular}>Sí, anular</button>
            <button className="boton-chico secundario" onClick={() => setPreguntar(false)}>No</button>
          </>
        )}
      </div>
      {error && <p className="error rx-no-imprimir" role="alert" style={{ maxWidth: 760, margin: '0 auto 16px' }}>{error}</p>}
      {!receta && !error && <p className="suave" style={{ textAlign: 'center' }}>Cargando...</p>}

      {receta && (
        <div className="rx-hoja">
          <div className="rx-marca" aria-hidden="true">{'DOCUMENTO DEMOSTRATIVO\nSIN VALIDEZ'}</div>

          <div className="rx-cab">
            <div>
              <h1>CAPS — Centro de Atención Primaria de la Salud</h1>
              <div className="rx-chico">Sistema de turnos (proyecto de tesis)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>Receta N° {receta.id}</strong>
              <div className="rx-chico">Fecha: {formatoFecha(receta.fecha)}</div>
            </div>
          </div>

          {receta.anulada && (
            <div className="rx-anulada">RECETA ANULADA{receta.anulada_en ? ` el ${formatoFecha(receta.anulada_en.slice(0, 10))}` : ''}</div>
          )}

          <div className="rx-datos">
            <div><span className="rx-chico">Paciente</span><br /><strong>{receta.paciente.apellido}, {receta.paciente.nombre}</strong></div>
            <div><span className="rx-chico">DNI</span><br />{receta.paciente.dni}</div>
            {receta.paciente.fecha_nacimiento && (
              <div><span className="rx-chico">Edad</span><br />{edad(receta.paciente.fecha_nacimiento)} años</div>
            )}
            <div><span className="rx-chico">Cobertura</span><br />{receta.paciente.cobertura || 'Sin cobertura'}</div>
          </div>

          {receta.diagnostico && <p><span className="rx-chico">Diagnóstico:</span> {receta.diagnostico}</p>}

          <div className="rx-titulo">Rp/</div>
          <ol className="rx-items">
            {receta.items.map((it, n) => (
              <li key={n}>
                <strong>{it.medicamento}</strong>{it.presentacion ? ` — ${it.presentacion}` : ''}{it.cantidad ? ` (${it.cantidad})` : ''}
                <div>{it.dosis}</div>
              </li>
            ))}
          </ol>

          {receta.indicaciones && (
            <>
              <div className="rx-chico">Indicaciones</div>
              <p style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{receta.indicaciones}</p>
            </>
          )}

          <div className="rx-firma">
            <div>
              Dr/a. {receta.medico.apellido}, {receta.medico.nombre}<br />
              {receta.medico.especialidad} · M.P. {receta.medico.matricula}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
