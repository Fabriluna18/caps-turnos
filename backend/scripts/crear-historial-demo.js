// Historial de ejemplo para las cuentas demo, así al entrar con ellas hay cosas para mostrar:
//  - Médica demo (22222222): seis meses de consultas con varios pacientes, atenciones, recetas
//    (algunas anuladas), fichas y turnos para las próximas dos semanas.
//  - Paciente demo (33333333): consultas pasadas con varios médicos, recetas y ausencias.
// TODO ES FICTICIO. Solo agrega (no borra ni cambia nada) y no se duplica si se corre otra vez.
// Necesita "npm run demo" antes. Si están los datos completos (demo:completo), usa sus médicos y pacientes.
// Uso: npm run demo:historial
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ahora, sumarDias, diaSemanaISO, horaSQL } = require('../fechas');
const { CLINICA } = require('./datos-clinicos');

const MESES_ATRAS = 6;
const DIAS_ADELANTE = 14;

// Números al azar, pero siempre los mismos
let semilla = 20261128;
function azar() {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
}
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const decimal = (min, max) => Math.round((min + azar() * (max - min)) * 10) / 10;
const aMin = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

// Pacientes extra, solo si la base tiene muy pocos (DNI 30300001 en adelante, sin email)
const EXTRA = [
  ['Ana', 'Sosa', '1958-03-14', 'PAMI'], ['Jorge', 'Medina', '1966-07-02', 'PAMI'], ['Rocío', 'Acosta', '1990-11-21', null],
  ['Carlos', 'Vega', '1975-01-30', 'IOMA'], ['Paula', 'Ríos', '1984-05-09', 'OSECAC'], ['Raúl', 'Cabrera', '1949-09-17', 'PAMI'],
  ['Norma', 'Aguirre', '1961-12-03', 'PAMI'], ['Hernán', 'Castro', '1979-04-25', null], ['Silvia', 'Rojas', '1970-08-11', 'IOMA'],
  ['Matías', 'Herrera', '1995-02-06', null], ['Graciela', 'Luna', '1953-06-28', 'PAMI'], ['Oscar', 'Pereyra', '1968-10-19', 'OSDE'],
  ['Julieta', 'Torres', '1988-03-01', 'Incluir Salud'], ['Miguel', 'Ruiz', '1957-11-12', 'PAMI'], ['Florencia', 'Díaz', '1993-07-23', null],
];

async function main() {
  const [[medica]] = await pool.query(
    `SELECT u.id, e.nombre AS especialidad FROM usuarios u JOIN medicos m ON m.usuario_id = u.id
     JOIN especialidades e ON e.id = m.especialidad_id WHERE u.dni = '22222222'`
  );
  const [[paciente]] = await pool.query("SELECT id FROM usuarios WHERE dni = '33333333' AND rol = 'paciente'");
  const [[secretaria]] = await pool.query("SELECT id FROM usuarios WHERE dni = '11111111'");
  if (!medica || !paciente || !secretaria) throw new Error('Primero creá los usuarios demo con "npm run demo".');

  // Marca de "ya cargado": la paciente demo ya tiene consultas de hace más de un mes
  const hoy = ahora().fecha;
  const [[{ viejas }]] = await pool.query(
    "SELECT COUNT(*) AS viejas FROM turnos WHERE paciente_id = ? AND estado = 'atendido' AND fecha < ?",
    [paciente.id, sumarDias(hoy, -30)]
  );
  if (Number(viejas) >= 3) {
    console.log('El historial de las cuentas demo ya está cargado. No se agregó nada.');
    return;
  }

  const a = ahora();
  const desde = sumarDias(hoy, -MESES_ATRAS * 30);
  const hasta = sumarDias(hoy, DIAS_ADELANTE);
  const hash = await bcrypt.hash('demo1234', 10);

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // --- Pacientes para la médica: los que haya (adultos), o se crean unos pocos ---
    let [otros] = await conexion.query(
      `SELECT u.id FROM usuarios u JOIN pacientes p ON p.usuario_id = u.id
       WHERE u.rol = 'paciente' AND u.activo = 1 AND u.id <> ?
         AND (p.fecha_nacimiento IS NULL OR p.fecha_nacimiento <= DATE_SUB(CURDATE(), INTERVAL 18 YEAR))
       ORDER BY u.id LIMIT 60`,
      [paciente.id]
    );
    if (otros.length < 15) {
      for (const [i, [nombre, apellido, nacimiento, cobertura]] of EXTRA.entries()) {
        const dni = String(30300001 + i);
        const [ya] = await conexion.query('SELECT id FROM usuarios WHERE dni = ?', [dni]);
        if (ya.length) continue;
        const [u] = await conexion.query(
          "INSERT INTO usuarios (dni, nombre, apellido, telefono, password_hash, rol) VALUES (?, ?, ?, ?, ?, 'paciente')",
          [dni, nombre, apellido, `11 5${entre(100, 999)}-${entre(1000, 9999)}`, hash]
        );
        await conexion.query(
          'INSERT INTO pacientes (usuario_id, fecha_nacimiento, direccion, localidad, cobertura) VALUES (?, ?, ?, ?, ?)',
          [u.insertId, nacimiento, `Calle ${entre(1, 200)} N° ${entre(100, 3999)}`, 'Localidad de ejemplo', cobertura]
        );
        otros.push({ id: u.insertId });
      }
    }
    const pacientesMedica = otros.map((o) => o.id);

    // --- Médicos (con sus horarios) con los que se atendió la paciente demo ---
    const [medicos] = await conexion.query(
      `SELECT u.id, e.nombre AS especialidad FROM usuarios u JOIN medicos m ON m.usuario_id = u.id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE u.activo = 1 AND e.nombre IN ('Clínica médica', 'Ginecología', 'Odontología')`
    );
    const [horarios] = await conexion.query(
      'SELECT medico_id, dia_semana, hora_inicio, hora_fin, duracion_min FROM horarios WHERE activo = 1 AND eliminado = 0'
    );
    const horariosDe = (id) => horarios.filter((h) => h.medico_id === id);
    // Si la médica demo no tiene horarios, se usan lunes, miércoles y viernes de 8 a 12
    const horariosMedica = horariosDe(medica.id).length
      ? horariosDe(medica.id)
      : [1, 3, 5].map((d) => ({ dia_semana: d, hora_inicio: '08:00:00', hora_fin: '12:00:00', duracion_min: 30 }));

    // --- Lo que ya está ocupado (para no pisar turnos existentes) ---
    const [ocupados] = await conexion.query(
      "SELECT medico_id, paciente_id, fecha, hora FROM turnos WHERE estado <> 'cancelado' AND fecha BETWEEN ? AND ?",
      [desde, hasta]
    );
    const slotOcupado = new Set(ocupados.map((t) => `${t.medico_id}|${t.fecha}|${t.hora}`));
    const pacienteOcupado = new Set(ocupados.map((t) => `${t.paciente_id}|${t.fecha}`));
    const [fer] = await conexion.query('SELECT fecha FROM feriados WHERE activo = 1 AND fecha BETWEEN ? AND ?', [desde, hasta]);
    const feriados = new Set(fer.map((f) => f.fecha));
    const [lic] = await conexion.query('SELECT medico_id, desde, hasta FROM licencias WHERE activa = 1 AND hasta >= ?', [desde]);
    const deLicencia = (medicoId, f) => lic.some((l) => l.medico_id === medicoId && l.desde <= f && l.hasta >= f);

    const turnos = [];
    const agregar = (medicoId, especialidad, pacienteId, fecha, hora, min, estado) => {
      slotOcupado.add(`${medicoId}|${fecha}|${hora}`);
      pacienteOcupado.add(`${pacienteId}|${fecha}`);
      turnos.push({ medicoId, especialidad, pacienteId, fecha, hora, min, estado, caso: uno(CLINICA[especialidad] || CLINICA['Clínica médica']) });
    };
    const estadoPasado = () => {
      const r = azar();
      return r < 0.8 ? 'atendido' : r < 0.9 ? 'ausente' : 'cancelado';
    };

    // --- 1. Agenda de la médica demo: seis meses atrás y dos semanas adelante ---
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
      if (feriados.has(f) || deLicencia(medica.id, f)) continue;
      for (const h of horariosMedica.filter((x) => x.dia_semana === diaSemanaISO(f))) {
        for (let t = aMin(h.hora_inicio); t + h.duracion_min <= aMin(h.hora_fin); t += h.duracion_min) {
          const hora = horaSQL(t);
          if (slotOcupado.has(`${medica.id}|${f}|${hora}`)) continue;
          const yaPaso = f < hoy || (f === hoy && t <= a.minutos);
          if (azar() > (yaPaso ? 0.55 : 0.4)) continue;
          // La paciente demo aparece cada tanto en las consultas pasadas de la médica demo
          // (en las futuras no, porque ya tiene sus propios turnos reservados)
          const conLaDemo = turnos.filter((x) => x.pacienteId === paciente.id).length;
          const p = yaPaso && conLaDemo < 5 && azar() < 0.04 ? paciente.id : uno(pacientesMedica);
          if (pacienteOcupado.has(`${p}|${f}`)) continue;
          const estado = yaPaso ? estadoPasado() : azar() < 0.1 ? 'cancelado' : azar() < 0.5 ? 'confirmado' : 'pendiente';
          agregar(medica.id, medica.especialidad, p, f, hora, h.duracion_min, estado);
        }
      }
    }

    // --- 2. Consultas pasadas de la paciente demo con otros médicos ---
    const otrosMedicos = medicos.filter((m) => m.id !== medica.id && horariosDe(m.id).length);
    for (let i = 0; i < 10 && otrosMedicos.length; i += 1) {
      const m = uno(otrosMedicos);
      for (let intento = 0; intento < 40; intento += 1) {
        const f = sumarDias(hoy, -entre(3, MESES_ATRAS * 30));
        const h = horariosDe(m.id).find((x) => x.dia_semana === diaSemanaISO(f));
        if (!h || feriados.has(f) || deLicencia(m.id, f) || pacienteOcupado.has(`${paciente.id}|${f}`)) continue;
        const cupos = (aMin(h.hora_fin) - aMin(h.hora_inicio)) / h.duracion_min;
        const hora = horaSQL(aMin(h.hora_inicio) + entre(0, cupos - 1) * h.duracion_min);
        if (slotOcupado.has(`${m.id}|${f}|${hora}`)) continue;
        agregar(m.id, m.especialidad, paciente.id, f, hora, h.duracion_min, i === 3 ? 'ausente' : 'atendido');
        break;
      }
    }

    if (turnos.length === 0) {
      console.log('No había lugar para agregar turnos. No se agregó nada.');
      await conexion.rollback();
      return;
    }

    // --- Se guardan los turnos ---
    for (const t of turnos) {
      const [r] = await conexion.query(
        `INSERT INTO turnos (medico_id, paciente_id, fecha, hora, duracion_min, estado, motivo, creado_por, cancelado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.medicoId, t.pacienteId, t.fecha, t.hora, t.min, t.estado, t.caso[0], secretaria.id, t.estado === 'cancelado' ? `${t.fecha} 07:00:00` : null]
      );
      t.id = r.insertId;
    }

    // --- Atenciones y recetas de los atendidos ---
    const [nacimientos] = await conexion.query(
      'SELECT usuario_id, fecha_nacimiento FROM pacientes WHERE usuario_id IN (?)',
      [[...new Set(turnos.map((t) => t.pacienteId))]]
    );
    const nacio = Object.fromEntries(nacimientos.map((n) => [n.usuario_id, n.fecha_nacimiento]));
    let atenciones = 0;
    let recetas = 0;
    let anuladas = 0;
    const atendidoPor = new Map();
    for (const t of turnos.filter((x) => x.estado === 'atendido')) {
      const chico = nacio[t.pacienteId] && nacio[t.pacienteId] > sumarDias(hoy, -18 * 365);
      const conVitales = t.especialidad !== 'Odontología';
      const sis = entre(105, 150);
      const fin = `${t.fecha} ${horaSQL(aMin(t.hora) + t.min - 2)}`;
      await conexion.query(
        `INSERT INTO atenciones (turno_id, medico_id, paciente_id, motivo_consulta, presion_sistolica, presion_diastolica,
          frecuencia_cardiaca, temperatura, saturacion, peso_kg, talla_cm, examen_fisico, diagnostico, indicaciones,
          finalizada, finalizada_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          t.id, t.medicoId, t.pacienteId, t.caso[0],
          conVitales && !chico ? sis : null, conVitales && !chico ? sis - entre(35, 50) : null,
          conVitales ? entre(60, 95) : null,
          conVitales ? decimal(36, t.caso[0].toLowerCase().includes('fiebre') ? 38.6 : 37.2) : null,
          conVitales ? entre(95, 99) : null,
          conVitales ? decimal(52, 98) : null,
          conVitales ? entre(150, 188) : null,
          conVitales ? 'Buen estado general. Sin particularidades al examen.' : 'Examen bucal realizado.',
          t.caso[1], 'Pautas de alarma explicadas. Control según evolución.', fin, fin,
        ]
      );
      atenciones += 1;
      if (!atendidoPor.has(t.pacienteId)) atendidoPor.set(t.pacienteId, t.medicoId);

      // Receta (casi siempre que el caso lleva medicamentos); algunas quedan anuladas
      if (t.caso[2].length && azar() < 0.85) {
        const anular = azar() < 0.08;
        const [r] = await conexion.query(
          `INSERT INTO recetas (turno_id, medico_id, paciente_id, fecha, diagnostico, indicaciones, anulada, anulada_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.medicoId, t.pacienteId, t.fecha, t.caso[1], 'Ante cualquier duda, consultar.', anular ? 1 : 0, anular ? fin : null]
        );
        for (const [n, it] of t.caso[2].entries()) {
          await conexion.query(
            'INSERT INTO receta_items (receta_id, orden, medicamento, presentacion, dosis, cantidad) VALUES (?, ?, ?, ?, ?, ?)',
            [r.insertId, n + 1, ...it]
          );
        }
        recetas += 1;
        if (anular) anuladas += 1;
      }
    }

    // --- Fichas clínicas para los atendidos que todavía no tienen ---
    const GRUPOS = ['0+', '0+', 'A+', 'A+', 'B+', 'AB+', '0-'];
    const ALERGIAS = [null, null, null, 'Penicilina', 'AINES', 'Látex'];
    let fichas = 0;
    for (const [pacienteId, medicoId] of atendidoPor) {
      const [ya] = await conexion.query('SELECT id FROM fichas WHERE paciente_id = ? LIMIT 1', [pacienteId]);
      if (ya.length) continue;
      await conexion.query(
        `INSERT INTO fichas (paciente_id, grupo_sanguineo, alergias, enfermedades, medicacion,
          antecedentes_personales, antecedentes_familiares, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pacienteId, uno(GRUPOS), uno(ALERGIAS), uno([null, 'Hipertensión arterial', 'Diabetes tipo 2', 'Asma']),
          uno([null, 'Enalapril 10 mg', 'Metformina 850 mg']), uno([null, 'Apendicectomía', 'Fractura de muñeca']),
          uno([null, 'Padre con diabetes', 'Madre hipertensa']), medicoId,
        ]
      );
      fichas += 1;
    }

    await conexion.commit();

    const cuenta = (lista, e) => lista.filter((t) => t.estado === e).length;
    const deMedica = turnos.filter((t) => t.medicoId === medica.id);
    const dePaciente = turnos.filter((t) => t.pacienteId === paciente.id);
    console.log('Historial de las cuentas demo cargado (todo ficticio):');
    console.log(`  Médica 22222222: ${deMedica.length} turnos (${cuenta(deMedica, 'atendido')} atendidos, ${cuenta(deMedica, 'ausente')} ausentes, ${cuenta(deMedica, 'pendiente') + cuenta(deMedica, 'confirmado')} próximos)`);
    console.log(`  Paciente 33333333: ${dePaciente.length} turnos nuevos (${cuenta(dePaciente, 'atendido')} atendidos)`);
    console.log(`  ${atenciones} atenciones, ${recetas} recetas (${anuladas} anuladas) y ${fichas} fichas nuevas`);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

main()
  .catch((e) => {
    console.error('No se pudo cargar el historial (no quedó nada a medias):', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
