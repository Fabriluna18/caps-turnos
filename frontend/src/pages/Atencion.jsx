import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import RecetaForm from '../components/RecetaForm';
import { ESTADOS } from '../estados';
import { diaDeSemana, edad, formatoFecha } from '../fechas';

const SIGNOS = [
  { id: 'presion_sistolica', texto: 'Presión máxima', unidad: 'mmHg', paso: 1 },
  { id: 'presion_diastolica', texto: 'Presión mínima', unidad: 'mmHg', paso: 1 },
  { id: 'frecuencia_cardiaca', texto: 'Frec. cardíaca', unidad: 'lpm', paso: 1 },
  { id: 'temperatura', texto: 'Temperatura', unidad: '°C', paso: 0.1 },
  { id: 'saturacion', texto: 'Saturación', unidad: '%', paso: 1 },
  { id: 'peso_kg', texto: 'Peso', unidad: 'kg', paso: 0.1 },
  { id: 'talla_cm', texto: 'Talla', unidad: 'cm', paso: 1 },
];
const TEXTOS = [
  { id: 'examen_fisico', texto: 'Examen físico', max: 2000, filas: 4 },
  { id: 'diagnostico', texto: 'Diagnóstico', max: 300, filas: 2 },
  { id: 'indicaciones', texto: 'Indicaciones', max: 2000, filas: 3 },
];
const CAMPOS = ['motivo_consulta', ...SIGNOS.map((s) => s.id), ...TEXTOS.map((t) => t.id)];

const formDesde = (a, motivoTurno) =>
  Object.fromEntries(CAMPOS.map((c) => [c, a?.[c] ?? (c === 'motivo_consulta' ? motivoTurno ?? '' : '')]));
const fechaHora = (t) => (t ? `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)} ${t.slice(11, 16)}` : '');

function imc(peso, talla) {
  const p = Number(String(peso).replace(',', '.'));
  const t = Number(talla) / 100;
  if (!p || !t) return null;
  return (p / (t * t)).toFixed(1);
}

export default function Atencion() {
  const { turnoId } = useParams();
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [cambios, setCambios] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [preguntarFin, setPreguntarFin] = useState(false);
  const [conReceta, setConReceta] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = useCallback(() => {
    apiFetch(`/medico/atencion/${turnoId}`)
      .then((r) => {
        setDatos(r);
        setForm(formDesde(r.atencion, r.turno.motivo));
        setCambios(false);
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, [turnoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setCambios(true);
    setOk('');
  };

  const enviar = async (finalizar) => {
    setError('');
    setOk('');
    setTrabajando(true);
    try {
      await apiFetch(`/medico/atencion/${turnoId}${finalizar ? '/finalizar' : ''}`, {
        method: finalizar ? 'POST' : 'PUT',
        body: JSON.stringify(form),
      });
      setOk(finalizar ? 'Atención finalizada. El turno quedó como atendido.' : 'Guardado.');
      setPreguntarFin(false);
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setTrabajando(false);
    }
  };

  const empezar = async () => {
    setError('');
    try {
      await apiFetch(`/medico/turnos/${turnoId}/estado`, { method: 'PUT', body: JSON.stringify({ estado: 'en_atencion' }) });
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const agregarNota = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/medico/atencion/${turnoId}/notas`, { method: 'POST', body: JSON.stringify({ texto: nota }) });
      setNota('');
      setOk('Nota agregada.');
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  if (!datos || !form) {
    return (
      <>
        <h1>Atención</h1>
        {error ? <p className="error" role="alert">{error}</p> : <p className="suave">Cargando...</p>}
      </>
    );
  }

  const { turno, paciente, atencion, editable } = datos;
  const finalizada = atencion?.finalizada;
  const valorImc = imc(form.peso_kg, form.talla_cm);

  return (
    <>
      <Link className="enlace" to="/medico/agenda"><ArrowLeft size={14} /> Volver a la agenda</Link>
      <h1>{paciente.apellido}, {paciente.nombre}</h1>
      <p className="suave" style={{ marginTop: 0 }}>
        DNI {paciente.dni}
        {paciente.fecha_nacimiento ? ` · ${edad(paciente.fecha_nacimiento)} años` : ''}
        {` · ${paciente.cobertura || 'Sin cobertura'} · `}
        <span style={{ textTransform: 'capitalize' }}>{diaDeSemana(turno.fecha)}</span> {formatoFecha(turno.fecha)} {turno.hora}{' '}
        <span className={`estado ${turno.estado}`}>{ESTADOS[turno.estado]}</span>
      </p>

      {paciente.alergias && (
        <p className="error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} /> <strong>Alergias:</strong> {paciente.alergias}
        </p>
      )}
      {paciente.medicacion && <p className="suave"><strong>Medicación habitual:</strong> {paciente.medicacion}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {ok && <p className="exito" role="status">{ok}</p>}

      {!editable && !atencion && (
        <div className="panel">
          <p className="suave">
            {['pendiente', 'confirmado'].includes(turno.estado)
              ? 'Para cargar la atención, primero empezá la consulta.'
              : 'Este turno no tiene una atención cargada.'}
          </p>
          {['pendiente', 'confirmado'].includes(turno.estado) && (
            <button className="boton" onClick={empezar}>Empezar atención</button>
          )}
        </div>
      )}

      {editable && (
        <form className="formulario" onSubmit={(e) => { e.preventDefault(); enviar(false); }}>
          <div className="panel">
            <h2>Motivo de consulta</h2>
            <input aria-label="Motivo de consulta" value={form.motivo_consulta} maxLength={300} onChange={(e) => cambiar('motivo_consulta', e.target.value)} />
          </div>

          <div className="panel">
            <h2>Signos vitales</h2>
            <div className="filtros" style={{ flexWrap: 'wrap' }}>
              {SIGNOS.map((s) => (
                <label key={s.id} className="campo" style={{ flex: '1 1 140px' }}>
                  {s.texto} ({s.unidad})
                  <input type="number" inputMode="decimal" step={s.paso} value={form[s.id]} onChange={(e) => cambiar(s.id, e.target.value)} />
                </label>
              ))}
              <div className="campo" style={{ flex: '1 1 140px' }}>
                IMC
                <strong style={{ fontSize: 20 }}>{valorImc ?? '—'}</strong>
              </div>
            </div>
            {datos.anterior && (
              <p className="leyenda">
                Consulta anterior ({formatoFecha(datos.anterior.fecha)}):
                {datos.anterior.peso_kg != null ? ` peso ${datos.anterior.peso_kg} kg` : ''}
                {datos.anterior.talla_cm != null ? ` · talla ${datos.anterior.talla_cm} cm` : ''}
              </p>
            )}
          </div>

          <div className="panel">
            {TEXTOS.map((t) => (
              <label key={t.id} className="campo">
                {t.texto}
                <textarea rows={t.filas} maxLength={t.max} value={form[t.id]} onChange={(e) => cambiar(t.id, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="acciones">
            <button className="boton" disabled={trabajando || !cambios}>{trabajando ? 'Guardando...' : 'Guardar'}</button>
            {!preguntarFin && (
              <button type="button" className="boton" disabled={trabajando} onClick={() => setPreguntarFin(true)}>Finalizar atención</button>
            )}
            {preguntarFin && (
              <>
                <span>¿Finalizar? Después no se puede editar, solo agregar notas.</span>
                <button type="button" className="boton" disabled={trabajando} onClick={() => enviar(true)}>Sí, finalizar</button>
                <button type="button" className="boton secundario" onClick={() => setPreguntarFin(false)}>No</button>
              </>
            )}
            <button type="button" className="boton secundario" onClick={() => setConReceta((v) => !v)}>
              <FileText size={14} /> {conReceta ? 'Ocultar receta' : 'Hacer receta'}
            </button>
          </div>
          {cambios && <p className="leyenda">Tenés cambios sin guardar.</p>}
        </form>
      )}

      {finalizada && (
        <div className="panel">
          <h2>Atención finalizada</h2>
          <dl className="datos">
            <div><dt>Motivo</dt><dd>{atencion.motivo_consulta || '—'}</dd></div>
            <div>
              <dt>Signos vitales</dt>
              <dd>
                {SIGNOS.filter((s) => atencion[s.id] != null).map((s) => `${s.texto}: ${atencion[s.id]} ${s.unidad}`).join(' · ') || '—'}
                {imc(atencion.peso_kg, atencion.talla_cm) ? ` · IMC: ${imc(atencion.peso_kg, atencion.talla_cm)}` : ''}
              </dd>
            </div>
            {TEXTOS.map((t) => (
              <div key={t.id}><dt>{t.texto}</dt><dd style={{ whiteSpace: 'pre-line' }}>{atencion[t.id] || '—'}</dd></div>
            ))}
          </dl>
          <p className="leyenda">Finalizada el {fechaHora(atencion.finalizada_en)}. No se puede modificar: para corregir o ampliar, agregá una nota.</p>

          {datos.notas.length > 0 && (
            <>
              <h3>Notas agregadas</h3>
              {datos.notas.map((n) => (
                <p key={n.id} style={{ whiteSpace: 'pre-line' }}>
                  <span className="suave">{fechaHora(n.fecha)} · {n.autor}:</span> {n.texto}
                </p>
              ))}
            </>
          )}
          <form className="formulario" onSubmit={agregarNota}>
            <label className="campo">
              Agregar nota
              <textarea rows={2} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
            <div className="acciones">
              <button className="boton-chico" disabled={nota.trim().length < 3}>Agregar nota</button>
              <button type="button" className="boton-chico secundario" onClick={() => setConReceta((v) => !v)}>
                <FileText size={14} /> {conReceta ? 'Ocultar receta' : 'Hacer receta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {conReceta && (
        <RecetaForm
          turno={{ id: turno.id, paciente }}
          onCerrar={() => setConReceta(false)}
          onListo={(id) => {
            setConReceta(false);
            setOk('Receta emitida.');
            window.open(`/receta/${id}`, '_blank', 'noopener');
          }}
        />
      )}
    </>
  );
}
