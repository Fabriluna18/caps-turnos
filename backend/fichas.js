// Ficha clínica: lectura, validación y versiones (nunca se pisa ni se borra)
const GRUPOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
const CAMPOS = {
  alergias: 500,
  enfermedades: 500,
  medicacion: 500,
  antecedentes_personales: 1000,
  antecedentes_familiares: 1000,
};
const NOMBRES = {
  alergias: 'Alergias',
  enfermedades: 'Enfermedades',
  medicacion: 'Medicación habitual',
  antecedentes_personales: 'Antecedentes personales',
  antecedentes_familiares: 'Antecedentes familiares',
};

function leerFicha(body) {
  const datos = {};
  const grupo = typeof body.grupo_sanguineo === 'string' ? body.grupo_sanguineo.trim().toUpperCase().replace('O', '0') : '';
  if (grupo && !GRUPOS.includes(grupo)) return { error: 'El grupo sanguíneo no es válido' };
  datos.grupo_sanguineo = grupo || null;
  for (const [campo, max] of Object.entries(CAMPOS)) {
    const v = typeof body[campo] === 'string' ? body[campo].trim() : '';
    if (v.length > max) return { error: `${NOMBRES[campo]}: máximo ${max} letras` };
    datos[campo] = v || null;
  }
  return { datos };
}

const COLUMNAS = ['grupo_sanguineo', ...Object.keys(CAMPOS)];

async function fichaActual(conexion, pacienteId) {
  const [filas] = await conexion.query(
    `SELECT f.id, ${COLUMNAS.map((c) => `f.${c}`).join(', ')}, f.creado_en, u.nombre AS autor_nombre, u.apellido AS autor_apellido
     FROM fichas f JOIN usuarios u ON u.id = f.creado_por
     WHERE f.paciente_id = ? ORDER BY f.id DESC LIMIT 1`,
    [pacienteId]
  );
  const f = filas[0];
  if (!f) return null;
  const ficha = Object.fromEntries(COLUMNAS.map((c) => [c, f[c]]));
  return { ...ficha, version_id: f.id, actualizado_en: f.creado_en, actualizado_por: `${f.autor_apellido}, ${f.autor_nombre}` };
}

module.exports = { leerFicha, fichaActual, COLUMNAS, GRUPOS };
