require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const origenes = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({ origin: origenes }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de CAPS Turnos funcionando' });
});

// Ruta de prueba de la conexión (la sacamos antes de publicar)
app.get('/db-test', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT NOW() AS ahora, VERSION() AS version');
    res.json({ conectado: true, ...filas[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ conectado: false, error: error.code || error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});