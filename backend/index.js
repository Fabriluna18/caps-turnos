require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const especialidadRoutes = require('./routes/especialidades');
const medicoRoutes = require('./routes/medicos');
const horarioRoutes = require('./routes/horarios');
const pacientesRoutes = require('./routes/pacientes');
const disponibilidadRoutes = require('./routes/disponibilidad');
const turnoRoutes = require('./routes/turnos');
const portalPacienteRoutes = require('./routes/paciente');
const pacienteTurnosRoutes = require('./routes/paciente-turnos');
const confirmarRoutes = require('./routes/confirmar');
const medicoPortalRoutes = require('./routes/medico');
const medicoPacientesRoutes = require('./routes/medico-pacientes');
const atencionRoutes = require('./routes/atencion');
const pacienteFichaRoutes = require('./routes/paciente-ficha');
const recetaRoutes = require('./routes/recetas');
const reporteRoutes = require('./routes/reportes');
const secretariaRoutes = require('./routes/secretaria');
const perfilRoutes = require('./routes/perfil');
const { iniciarRecordatorios } = require('./recordatorios');

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;
const origenes = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({ origin: origenes }));

// Cabeceras de seguridad para todas las respuestas
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', // el navegador no adivina tipos de archivo
    'X-Frame-Options': 'DENY', // nadie puede meter la API dentro de otra página
    'Referrer-Policy': 'no-referrer', // los enlaces con códigos (confirmar, restablecer) no se filtran a otros sitios
    'Cache-Control': 'no-store', // los datos no quedan guardados en la caché del navegador
  });
  next();
});
app.use(express.json());

// Si el frontend está compilado (npm run build en frontend), se sirve desde acá: un solo proceso.
// Si no, en desarrollo el frontend corre aparte con Vite (puerto 5173).
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const hayFrontend = fs.existsSync(path.join(DIST, 'index.html'));
if (hayFrontend) {
  app.use(express.static(DIST));
  // Las pantallas (/login, /secretaria/turnos, ...) las resuelve React: al navegador se le devuelve index.html.
  // Solo cuando pide una página (text/html); lo demás sigue al 404 de siempre.
  app.use((req, res, next) => {
    const esApi = req.path === '/api' || req.path.startsWith('/api/');
    const pidePagina = (req.headers.accept || '').includes('text/html');
    if (req.method !== 'GET' || esApi || !pidePagina) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ mensaje: 'API de CAPS Turnos funcionando' });
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/especialidades', especialidadRoutes);
app.use('/api/medicos', medicoRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/turnos', turnoRoutes);
// Los turnos del paciente van ANTES que el resto de /api/paciente
app.use('/api/paciente/turnos', pacienteTurnosRoutes);
app.use('/api/paciente/ficha', pacienteFichaRoutes);
app.use('/api/paciente', portalPacienteRoutes);
app.use('/api/confirmar', confirmarRoutes);
app.use('/api/medico/pacientes', medicoPacientesRoutes);
app.use('/api/medico/atencion', atencionRoutes);
app.use('/api/medico', medicoPortalRoutes);
app.use('/api/recetas', recetaRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/secretaria', secretariaRoutes);
app.use('/api/perfil', perfilRoutes);

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Los datos enviados no son válidos' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  if (hayFrontend) console.log(`Sistema listo: abrí http://localhost:${PORT} en el navegador`);
  iniciarRecordatorios();
});
