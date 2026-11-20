// Instalación del sistema en una PC (se puede correr de nuevo sin romper nada).
// 1. Crea el .env si no existe (con clave de la base y JWT_SECRET al azar)
// 2. Crea la base caps_turnos y corre db/schema.sql
// 3. Crea el usuario caps_app y le da los permisos de db/permisos.sql
// 4. Carga los usuarios demo y, si se pide, los datos de ejemplo completos
// Uso: con el MySQL de XAMPP prendido, "npm run instalar" (o doble clic en instalar.bat)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const BACKEND = path.join(__dirname, '..');
const ENV = path.join(BACKEND, '.env');
const EJEMPLO = path.join(BACKEND, '.env.example');
const BASE = 'caps_turnos';
const USUARIO = 'caps_app';

const azar = (bytes) => crypto.randomBytes(bytes).toString('hex');

// Lee un .env como objeto { CLAVE: valor }
function leerEnv(texto) {
  const datos = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=(.*)$/);
    if (m) datos[m[1]] = m[2].trim();
  }
  return datos;
}

// Cambia (o agrega) una variable dentro del texto del .env
function ponerEnv(texto, clave, valor) {
  const regla = new RegExp(`^${clave}=.*$`, 'm');
  return regla.test(texto) ? texto.replace(regla, `${clave}=${valor}`) : `${texto.trimEnd()}\n${clave}=${valor}\n`;
}

// 1. El .env: si no existe se crea; si existe solo se completa lo que falta
function prepararEnv() {
  const existia = fs.existsSync(ENV);
  let texto = fs.readFileSync(existia ? ENV : EJEMPLO, 'utf8');
  const actual = leerEnv(texto);

  if (!existia) {
    texto = ponerEnv(texto, 'DB_PASSWORD', azar(16));
    // Con el frontend compilado, todo se abre desde el backend (puerto 3001)
    texto = ponerEnv(texto, 'FRONTEND_URL', `http://localhost:${actual.PORT || 3001}`);
  }
  if (!actual.JWT_SECRET || actual.JWT_SECRET.length < 32) texto = ponerEnv(texto, 'JWT_SECRET', azar(48));

  fs.writeFileSync(ENV, texto);
  console.log(existia ? '✔ .env ya existía: se usa ese (solo se completó lo que faltaba)' : '✔ .env creado con claves nuevas al azar');
  return { env: leerEnv(texto), nuevo: !existia };
}

function correrScript(nombre) {
  const r = spawnSync(process.execPath, [path.join(__dirname, nombre)], { cwd: BACKEND, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Falló scripts/${nombre}`);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const preguntar = async (texto) => (await rl.question(texto)).trim();

  console.log('\n=== Instalación de CAPS Turnos ===\n');
  const { env, nuevo } = prepararEnv();

  if (env.DB_NAME !== BASE || env.DB_USER !== USUARIO) {
    throw new Error(`En el .env tienen que estar DB_NAME=${BASE} y DB_USER=${USUARIO} (schema.sql y permisos.sql usan esos nombres)`);
  }

  const claveRoot = await preguntar('Contraseña de root de MySQL (en XAMPP suele estar vacía, apretá Enter): ');
  let root;
  try {
    root = await mysql.createConnection({
      host: env.DB_HOST || '127.0.0.1',
      port: Number(env.DB_PORT || 3306),
      user: 'root',
      password: claveRoot,
      multipleStatements: true,
      charset: 'utf8mb4',
    });
  } catch (error) {
    throw new Error(`No me pude conectar a MySQL como root (${error.code}). ¿Está prendido MySQL en el panel de XAMPP? ¿La contraseña es correcta?`);
  }

  // 2. Base y tablas
  await root.query(`CREATE DATABASE IF NOT EXISTS ${BASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(fs.readFileSync(path.join(BACKEND, 'db', 'schema.sql'), 'utf8'));
  console.log('✔ Base y tablas listas (schema.sql)');

  // 3. Usuario caps_app. Si el .env es nuevo, se le pone su clave (también si el usuario ya existía).
  await root.query(`CREATE USER IF NOT EXISTS '${USUARIO}'@'localhost' IDENTIFIED BY ?`, [env.DB_PASSWORD]);
  if (nuevo) await root.query(`ALTER USER '${USUARIO}'@'localhost' IDENTIFIED BY ?`, [env.DB_PASSWORD]);
  await root.query(fs.readFileSync(path.join(BACKEND, 'db', 'permisos.sql'), 'utf8'));
  console.log(`✔ Usuario ${USUARIO} con sus permisos (sin DELETE ni DROP)`);

  // Se prueba que el sistema pueda entrar con los datos del .env
  try {
    const prueba = await mysql.createConnection({
      host: env.DB_HOST || '127.0.0.1',
      port: Number(env.DB_PORT || 3306),
      user: USUARIO,
      password: env.DB_PASSWORD,
      database: BASE,
    });
    await prueba.end();
  } catch {
    throw new Error(
      `El usuario ${USUARIO} no puede entrar con la clave del .env. ` +
        'Borrá el .env y volvé a correr la instalación para que se genere una clave nueva.'
    );
  }

  // 4. Datos
  console.log('\nCargando usuarios demo (secretaria 11111111, médica 22222222, paciente 33333333)...');
  correrScript('crear-demo.js');

  const completo = await preguntar('\n¿Cargar también los datos de ejemplo completos (6 médicos, 300 pacientes, 6 meses de turnos)? (s/N): ');
  if (completo.toLowerCase() === 's') correrScript('crear-datos-ejemplo.js');

  const definitiva = await preguntar(
    '\n¿Es la instalación definitiva en la PC del CAPS? Si decís que sí, todos tendrán que cambiar la clave "demo1234" al entrar. (s/N): '
  );
  if (definitiva.toLowerCase() === 's') {
    const [r] = await root.query(`UPDATE ${BASE}.usuarios SET debe_cambiar_clave = 1`);
    console.log(`✔ ${r.affectedRows} cuentas tendrán que cambiar la clave en el primer ingreso`);
  }

  await root.end();
  rl.close();
  console.log('\n✔ Instalación terminada. Para usar el sistema: doble clic en iniciar.bat\n');
}

main().catch((error) => {
  console.error(`\n✘ ${error.message}\n`);
  process.exit(1);
});
