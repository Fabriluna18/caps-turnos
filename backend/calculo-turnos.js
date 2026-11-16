const { diasEntre, diaSemanaISO } = require('./fechas');

// Hasta cuántos días de anticipación se puede sacar un turno
const DIAS_ANTICIPACION = 60;

const aMin = (hora) => {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
};
const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const MENSAJES = {
  pasado: 'Esa fecha ya pasó.',
  lejano: `Solo se pueden sacar turnos con hasta ${DIAS_ANTICIPACION} días de anticipación.`,
  licencia: 'El médico no atiende ese día (está de licencia).',
  no_atiende: 'El médico no atiende ese día de la semana.',
  sin_turnos: 'Ya no quedan turnos para este día.',
  completo: 'Todos los turnos de este día están ocupados.',
};

// datos: { horarios, licencias, feriados, turnos }, ya cargados de la base
// ahora: { fecha: 'AAAA-MM-DD', minutos }
function calcularDia(datos, fecha, ahora) {
  const respuesta = (motivo, turnos = [], detalle = null) => ({
    motivo,
    detalle,
    mensaje: motivo === 'feriado' ? `Feriado: ${detalle}` : MENSAJES[motivo] || null,
    turnos,
  });

  if (fecha < ahora.fecha) return respuesta('pasado');
  if (diasEntre(ahora.fecha, fecha) > DIAS_ANTICIPACION) return respuesta('lejano');

  const feriado = datos.feriados.find((f) => f.fecha === fecha);
  if (feriado) return respuesta('feriado', [], feriado.descripcion);
  if (datos.licencias.some((l) => l.desde <= fecha && l.hasta >= fecha)) return respuesta('licencia');

  const bloques = datos.horarios.filter((h) => h.dia_semana === diaSemanaISO(fecha));
  if (bloques.length === 0) return respuesta('no_atiende');

  // Cada turno ocupado como un intervalo [desde, hasta) en minutos
  const ocupados = datos.turnos
    .filter((t) => t.fecha === fecha)
    .map((t) => [aMin(t.hora), aMin(t.hora) + t.duracion_min]);

  const turnos = [];
  for (const b of bloques) {
    const fin = aMin(b.hora_fin);
    for (let inicio = aMin(b.hora_inicio); inicio + b.duracion_min <= fin; inicio += b.duracion_min) {
      if (fecha === ahora.fecha && inicio <= ahora.minutos) continue; // ya pasó
      // Se pisa con un turno ocupado si los intervalos se cruzan
      const libre = !ocupados.some(([desde, hasta]) => desde < inicio + b.duracion_min && hasta > inicio);
      turnos.push({ hora: aHHMM(inicio), duracion_min: b.duracion_min, libre });
    }
  }

  if (turnos.length === 0) return respuesta('sin_turnos');
  if (!turnos.some((t) => t.libre)) return respuesta('completo', turnos);
  return respuesta(null, turnos);
}

// Cuántos turnos libres tiene cada día del mes (para pintar el calendario)
function calcularMes(datos, anio, mes, ahora) {
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dias = [];
  for (let d = 1; d <= total; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = calcularDia(datos, fecha, ahora);
    dias.push({ fecha, libres: r.turnos.filter((t) => t.libre).length, motivo: r.motivo });
  }
  return dias;
}

module.exports = { calcularDia, calcularMes, DIAS_ANTICIPACION };