// Prueba automática de permisos: recorre todas las rutas de la API con cada rol
// y verifica que cada uno pueda entrar solo a lo suyo.
// Uso: con el backend andando, en otra terminal: npm run probar:permisos
// No modifica datos: las rutas que cambian algo solo se prueban con los roles que NO pueden usarlas.
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}/api`;
const DNI = { secretaria: '11111111', medico: '22222222', paciente: '33333333' };
const ROLES = ['secretaria', 'medico', 'paciente'];

const hoy = new Date().toISOString().slice(0, 10);
const mes = hoy.slice(0, 7);

// [método, ruta, roles que pueden usarla]. Las de lectura se prueban también con el rol permitido.
function rutas(medicoId) {
  const S = ['secretaria'];
  const M = ['medico'];
  const P = ['paciente'];
  const TODOS = ROLES;
  return [
    // Lectura
    ['GET', '/especialidades', TODOS],
    ['GET', '/perfil', TODOS],
    ['GET', '/medicos', S],
    ['GET', '/pacientes', S],
    ['GET', `/horarios?medico_id=${medicoId}`, S],
    ['GET', `/horarios/licencias?medico_id=${medicoId}`, S],
    ['GET', '/horarios/feriados', S],
    ['GET', `/turnos?desde=${hoy}&hasta=${hoy}`, S],
    ['GET', '/disponibilidad/medicos', ['secretaria', 'paciente']],
    ['GET', `/disponibilidad/mes?medico_id=${medicoId}&mes=${mes}`, ['secretaria', 'paciente']],
    ['GET', `/reportes?desde=${hoy}&hasta=${hoy}`, S],
    ['GET', '/secretaria/resumen', S],
    ['GET', '/secretaria/semana', S],
    ['GET', '/medico/agenda', M],
    ['GET', '/medico/resumen', M],
    ['GET', '/medico/pacientes', M],
    ['GET', '/medico/licencias', M],
    ['GET', '/pacientes/coberturas', S],
    ['GET', '/recetas', ['medico', 'paciente']],
    ['GET', '/paciente/resumen', P],
    ['GET', '/paciente/turnos', P],
    ['GET', '/paciente/ficha', P],
    // Escritura (solo se prueba que los demás NO puedan)
    ['POST', '/especialidades', S, true],
    ['PUT', '/especialidades/999999', S, true],
    ['PUT', '/especialidades/999999/estado', S, true],
    ['DELETE', '/especialidades/999999', S, true],
    ['POST', '/medicos', S, true],
    ['PUT', '/medicos/999999', S, true],
    ['PUT', '/medicos/999999/estado', S, true],
    ['POST', '/medicos/999999/reset-clave', S, true],
    ['POST', '/pacientes', S, true],
    ['PUT', '/pacientes/999999', S, true],
    ['PUT', '/pacientes/999999/estado', S, true],
    ['POST', '/pacientes/999999/reset-clave', S, true],
    ['POST', '/horarios', S, true],
    ['PUT', '/horarios/999999', S, true],
    ['DELETE', '/horarios/999999', S, true],
    ['POST', '/horarios/licencias', S, true],
    ['POST', '/horarios/feriados', S, true],
    ['POST', '/turnos', S, true],
    ['PUT', '/turnos/999999/confirmar', S, true],
    ['PUT', '/turnos/999999/cancelar', S, true],
    ['PUT', '/turnos/999999/reprogramar', S, true],
    ['PUT', '/medico/turnos/999999/estado', M, true],
    ['POST', '/medico/licencias', M, true],
    ['PUT', '/medico/licencias/999999/estado', M, true],
    ['GET', '/medico/turnos/999999/historial', M, true],
    ['PUT', '/medico/pacientes/999999/ficha', M, true],
    ['GET', '/medico/atencion/999999', M, true],
    ['PUT', '/medico/atencion/999999', M, true],
    ['POST', '/medico/atencion/999999/finalizar', M, true],
    ['POST', '/medico/atencion/999999/notas', M, true],
    ['POST', '/recetas', M, true],
    ['PUT', '/recetas/999999/anular', M, true],
    ['POST', '/paciente/turnos', P, true],
    ['PUT', '/paciente/turnos/999999/cancelar', P, true],
    ['PUT', '/paciente/turnos/999999/confirmar', P, true],
  ];
}

async function pedir(metodo, ruta, token) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: metodo === 'GET' ? undefined : '{}',
  });
  return r;
}

async function main() {
  if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en el .env');

  // Ingresos de prueba con los usuarios demo (se firman con la clave del .env, no hace falta la contraseña)
  const tokens = {};
  let medicoId = 1;
  for (const rol of ROLES) {
    const [filas] = await pool.query('SELECT id, rol, activo, debe_cambiar_clave FROM usuarios WHERE dni = ?', [DNI[rol]]);
    const u = filas[0];
    if (!u || u.rol !== rol || !u.activo || u.debe_cambiar_clave) {
      throw new Error(`El usuario demo ${DNI[rol]} (${rol}) no existe, está de baja o tiene clave temporal. Corré "npm run demo" o revisalo.`);
    }
    tokens[rol] = jwt.sign({ id: u.id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    if (rol === 'medico') medicoId = u.id;
  }

  const resultados = [];
  const anotar = (prueba, esperado, obtenido) => resultados.push({ prueba, esperado, obtenido, ok: esperado.includes(obtenido) });

  for (const [metodo, ruta, permitidos, escritura] of rutas(medicoId)) {
    // Sin iniciar sesión: siempre 401
    anotar(`${metodo} ${ruta} · sin sesión`, [401], (await pedir(metodo, ruta, null)).status);
    for (const rol of ROLES) {
      if (permitidos.includes(rol)) {
        if (!escritura) anotar(`${metodo} ${ruta} · ${rol}`, [200], (await pedir(metodo, ruta, tokens[rol])).status);
      } else {
        anotar(`${metodo} ${ruta} · ${rol} (no permitido)`, [403], (await pedir(metodo, ruta, tokens[rol])).status);
      }
    }
  }

  // Sesiones falsas o vencidas
  const falso = jwt.sign({ id: 1 }, 'otra-clave-cualquiera', { algorithm: 'HS256' });
  anotar('Ingreso firmado con otra clave', [401], (await pedir('GET', '/perfil', falso)).status);
  const vencido = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  anotar('Ingreso vencido', [401], (await pedir('GET', '/perfil', vencido)).status);

  // Lo que ya no existe (nada se borra de la base)
  anotar('Borrar un médico: la ruta no existe', [404], (await pedir('DELETE', '/medicos/1', tokens.secretaria)).status);
  anotar('Borrar un paciente: la ruta no existe', [404], (await pedir('DELETE', '/pacientes/1', tokens.secretaria)).status);
  anotar('Ruta de prueba /db-test eliminada', [404], (await fetch(API.replace(/\/api$/, '') + '/db-test')).status);

  // Rutas públicas
  anotar('Confirmar turno con un enlace inventado', [404], (await pedir('GET', `/confirmar/${'a'.repeat(64)}`, null)).status);
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dni: '99999998', password: 'clave-equivocada' }),
  });
  anotar('Ingresar con datos incorrectos', [401, 429], login.status);

  // Cabeceras de seguridad
  const r = await pedir('GET', '/especialidades', tokens.secretaria);
  anotar('No dice qué servidor usa (sin X-Powered-By)', ['ausente'], r.headers.get('x-powered-by') ? 'presente' : 'ausente');
  anotar('Cabecera X-Content-Type-Options', ['nosniff'], r.headers.get('x-content-type-options'));
  anotar('Cabecera Referrer-Policy', ['no-referrer'], r.headers.get('referrer-policy'));

  const fallas = resultados.filter((x) => !x.ok);
  console.log(`\nPrueba de permisos contra ${API}\n`);
  for (const x of fallas) console.log(`FALLA  ${x.prueba}: se esperaba ${x.esperado.join(' o ')} y respondió ${x.obtenido}`);
  console.log(`\n${resultados.length - fallas.length} de ${resultados.length} pruebas correctas.`);
  console.log(fallas.length ? 'Hay fallas: revisalas arriba.' : 'Todo bien: cada rol entra solo a lo suyo.');
  if (process.argv.includes('--detalle')) console.table(resultados.map(({ prueba, esperado, obtenido }) => ({ prueba, esperado: esperado.join('/'), obtenido })));
  process.exitCode = fallas.length ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e.cause?.code === 'ECONNREFUSED' ? 'No se pudo conectar: ¿está el backend andando (npm run dev)?' : e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
