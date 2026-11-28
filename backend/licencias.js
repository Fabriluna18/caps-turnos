// Licencias (días en que un médico no atiende). Las usan la secretaría (Horarios)
// y el propio médico ("Mis ausencias"), así las reglas son siempre las mismas.
// Nada se borra: una licencia se cancela y se puede reactivar.
const { fechaValida, diasEntre } = require('./fechas');
const { contarTurnosFuturos, textoTurnos } = require('./turnos-futuros');

const aLicencia = (f) => ({ ...f, activa: Boolean(f.activa) });

async function listarLicencias(conexion, medicoId) {
  const [filas] = await conexion.query(
    'SELECT id, desde, hasta, motivo, activa FROM licencias WHERE medico_id = ? ORDER BY desde DESC LIMIT 100',
    [medicoId]
  );
  return filas.map(aLicencia);
}

// Valida y carga una licencia. Devuelve { ok: true } o { codigo, error }.
// "quien" cambia el texto del aviso cuando hay turnos reservados en esas fechas.
async function crearLicencia(conexion, medicoId, body, { quien = 'secretaria', minimo = null } = {}) {
  const { desde, hasta } = body;
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';

  if (!fechaValida(desde) || !fechaValida(hasta)) return { codigo: 400, error: 'Ingresá las dos fechas' };
  if (hasta < desde) return { codigo: 400, error: 'La fecha "hasta" no puede ser anterior a "desde"' };
  if (minimo && desde < minimo) return { codigo: 400, error: 'La ausencia no puede empezar en un día que ya pasó' };
  if (diasEntre(desde, hasta) > 400) return { codigo: 400, error: 'La licencia no puede durar más de 400 días' };
  if (motivo.length > 100) return { codigo: 400, error: 'El motivo es demasiado largo (máximo 100 letras)' };

  const [medico] = await conexion.query('SELECT usuario_id FROM medicos WHERE usuario_id = ?', [medicoId]);
  if (medico.length === 0) return { codigo: 404, error: 'Médico no encontrado' };

  const [choque] = await conexion.query(
    'SELECT id FROM licencias WHERE medico_id = ? AND activa = 1 AND desde <= ? AND hasta >= ? LIMIT 1',
    [medicoId, hasta, desde]
  );
  if (choque.length > 0) {
    return { codigo: 409, error: quien === 'medico' ? 'Ya tenés una ausencia cargada en esas fechas' : 'Ya hay una licencia vigente en esas fechas' };
  }

  const n = await contarTurnosFuturos(conexion, { medicoId, desde, hasta });
  if (n > 0) {
    return {
      codigo: 409,
      error:
        quien === 'medico'
          ? `Tenés ${textoTurnos(n)} reservados en esas fechas. Pedile a la secretaría que los reprograme o cancele, y después cargá la ausencia.`
          : `Hay ${textoTurnos(n)} reservados en esas fechas. Cancelalos o reprogramalos antes de cargar la licencia.`,
    };
  }

  await conexion.query('INSERT INTO licencias (medico_id, desde, hasta, motivo) VALUES (?, ?, ?, ?)', [
    medicoId,
    desde,
    hasta,
    motivo || null,
  ]);
  return { ok: true };
}

// Cancela o reactiva. Con soloMedicoId, solo si la licencia es de ese médico (si no, 404).
async function cambiarEstadoLicencia(conexion, id, activa, { soloMedicoId = null, quien = 'secretaria' } = {}) {
  const [filas] = await conexion.query('SELECT medico_id, desde, hasta FROM licencias WHERE id = ?', [id]);
  const l = filas[0];
  if (!l || (soloMedicoId && l.medico_id !== soloMedicoId)) return { codigo: 404, error: 'Licencia no encontrada' };

  if (activa) {
    const [choque] = await conexion.query(
      'SELECT id FROM licencias WHERE medico_id = ? AND activa = 1 AND desde <= ? AND hasta >= ? AND id <> ? LIMIT 1',
      [l.medico_id, l.hasta, l.desde, id]
    );
    if (choque.length > 0) return { codigo: 409, error: 'Se pisa con otra licencia vigente de ese médico' };

    const n = await contarTurnosFuturos(conexion, { medicoId: l.medico_id, desde: l.desde, hasta: l.hasta });
    if (n > 0) {
      return {
        codigo: 409,
        error:
          quien === 'medico'
            ? `Tenés ${textoTurnos(n)} reservados en esas fechas. Pedile a la secretaría que los reprograme antes de reactivarla.`
            : `Hay ${textoTurnos(n)} reservados en esas fechas. Cancelalos o reprogramalos antes de reactivar la licencia.`,
      };
    }
  }

  await conexion.query('UPDATE licencias SET activa = ? WHERE id = ?', [activa ? 1 : 0, id]);
  return { ok: true };
}

module.exports = { listarLicencias, crearLicencia, cambiarEstadoLicencia };
