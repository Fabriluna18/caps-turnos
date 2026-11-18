const ZONA = 'America/Argentina/Buenos_Aires';

// Fecha y hora de ahora en Argentina: { fecha: 'AAAA-MM-DD', minutos: minutos desde las 00:00 }
function ahora() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return { fecha: `${v.year}-${v.month}-${v.day}`, minutos: Number(v.hour) * 60 + Number(v.minute) };
}

function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

const diasEntre = (desde, hasta) =>
  Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86400000);

// 1 = lunes ... 7 = domingo
function diaSemanaISO(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

// Suma (o resta) días a una fecha AAAA-MM-DD
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// 570 minutos -> '09:30:00'
function horaSQL(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}:00`;
}

module.exports = { ahora, fechaValida, diasEntre, diaSemanaISO, sumarDias, horaSQL };