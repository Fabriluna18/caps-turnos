import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';

const MAX = 5;
const filaVacia = () => ({ medicamento: '', presentacion: '', dosis: '', cantidad: '' });

// Formulario de receta para un turno de la agenda
export default function RecetaForm({ turno, onListo, onCerrar }) {
  const [items, setItems] = useState([filaVacia()]);
  const [diagnostico, setDiagnostico] = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (n, campo, valor) => setItems((lista) => lista.map((it, i) => (i === n ? { ...it, [campo]: valor } : it)));

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const r = await apiFetch('/recetas', {
        method: 'POST',
        body: JSON.stringify({ turno_id: turno.id, diagnostico, indicaciones, items }),
      });
      onListo(r.id);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="panel">
      <h2>Receta para {turno.paciente.apellido}, {turno.paciente.nombre}</h2>
      <p className="suave">Una vez emitida no se edita: si hay un error, se anula y se hace otra.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          Diagnóstico (opcional)
          <input value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} maxLength={200} />
        </label>

        {items.map((it, n) => (
          <fieldset key={n} className="panel" style={{ margin: 0 }}>
            <legend><strong>Medicamento {n + 1}</strong></legend>
            <div className="filtros">
              <label className="campo">
                Medicamento (genérico)
                <input value={it.medicamento} onChange={(e) => cambiar(n, 'medicamento', e.target.value)} maxLength={150} required />
              </label>
              <label className="campo">
                Presentación
                <input value={it.presentacion} onChange={(e) => cambiar(n, 'presentacion', e.target.value)} maxLength={100} placeholder="Ej: 500 mg comprimidos" />
              </label>
            </div>
            <div className="filtros">
              <label className="campo">
                Cómo tomarlo
                <input value={it.dosis} onChange={(e) => cambiar(n, 'dosis', e.target.value)} maxLength={150} placeholder="Ej: 1 cada 8 horas por 5 días" required />
              </label>
              <label className="campo">
                Cantidad
                <input value={it.cantidad} onChange={(e) => cambiar(n, 'cantidad', e.target.value)} maxLength={50} placeholder="Ej: 1 caja" />
              </label>
            </div>
            {items.length > 1 && (
              <button type="button" className="boton-chico secundario" onClick={() => setItems((l) => l.filter((_, i) => i !== n))}>
                <Trash2 size={14} /> Quitar
              </button>
            )}
          </fieldset>
        ))}

        {items.length < MAX && (
          <button type="button" className="boton-chico" onClick={() => setItems((l) => [...l, filaVacia()])}>
            <Plus size={14} /> Agregar medicamento
          </button>
        )}

        <label className="campo">
          Indicaciones (opcional)
          <textarea value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} maxLength={1000} rows={3} />
        </label>

        <div className="acciones">
          <button className="boton" disabled={guardando}>{guardando ? 'Guardando...' : 'Emitir receta'}</button>
          <button type="button" className="boton secundario" onClick={onCerrar}>Cerrar</button>
        </div>
      </form>
    </div>
  );
}
