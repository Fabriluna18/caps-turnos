import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { formatoFecha, hoyISO } from '../fechas';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const numero = (n) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));

const ultimoDia = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Rangos rápidos (el "hasta" nunca pasa de hoy)
function rango(tipo) {
  const hoy = hoyISO();
  const a = Number(hoy.slice(0, 4));
  const m = Number(hoy.slice(5, 7));
  const atras = (meses) => {
    const n = a * 12 + (m - 1) - meses;
    return iso(Math.floor(n / 12), (n % 12) + 1, 1);
  };
  if (tipo === 'mes') return { desde: iso(a, m, 1), hasta: hoy };
  if (tipo === 'pasado') {
    const d = atras(1);
    return { desde: d, hasta: iso(Number(d.slice(0, 4)), Number(d.slice(5, 7)), ultimoDia(Number(d.slice(0, 4)), Number(d.slice(5, 7)))) };
  }
  if (tipo === '3') return { desde: atras(2), hasta: hoy };
  if (tipo === '6') return { desde: atras(5), hasta: hoy };
  return { desde: iso(a, 1, 1), hasta: hoy };
}
const RAPIDOS = [
  ['mes', 'Este mes'],
  ['pasado', 'Mes pasado'],
  ['3', 'Últimos 3 meses'],
  ['6', 'Últimos 6 meses'],
  ['anio', 'Este año'],
];

function descargarCSV(r) {
  const fila = (celdas) => celdas.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';');
  const lineas = [
    fila(['Reporte de atención', `${formatoFecha(r.desde)} al ${formatoFecha(r.hasta)}`]),
    '',
    fila(['Médico', 'Especialidad', 'Atendidos', 'Pacientes distintos', 'Ausentes', 'Cancelados', 'Promedio mensual']),
    ...r.por_medico.map((m) =>
      fila([`${m.apellido}, ${m.nombre}${m.activo ? '' : ' (de baja)'}`, m.especialidad, m.atendidos, m.pacientes, m.ausentes, m.cancelados, numero(m.promedio_mensual)])
    ),
    fila(['TOTAL', '', r.totales.atendidos, r.totales.pacientes, r.totales.ausentes, r.totales.cancelados, numero(r.totales.promedio_mensual)]),
    '',
    fila(['Mes', 'Atendidos', 'Ausentes', 'Cancelados']),
    ...r.por_mes.map((m) => fila([nombreMes(m.mes), m.atendidos, m.ausentes, m.cancelados])),
  ];
  // El BOM y el ";" hacen que Excel lo abra bien en español
  const blob = new Blob([`﻿${lineas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${r.desde}-a-${r.hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const tarjeta = { display: 'flex', flexDirection: 'column', gap: 4 };

export default function Reportes() {
  const [filtros, setFiltros] = useState({ ...rango('6'), especialidad_id: '', medico_id: '' });
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [r, setR] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [verTabla, setVerTabla] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch('/medicos'), apiFetch('/especialidades')])
      .then(([m, e]) => {
        setMedicos(m);
        setEspecialidades(e);
      })
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  const generar = useCallback(async (f) => {
    setError('');
    setCargando(true);
    try {
      const params = new URLSearchParams({ desde: f.desde, hasta: f.hasta });
      if (f.especialidad_id) params.set('especialidad_id', f.especialidad_id);
      if (f.medico_id) params.set('medico_id', f.medico_id);
      setR(await apiFetch(`/reportes?${params}`));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    generar(filtros);
    // Solo la primera vez; después se genera con el botón
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor, ...(campo === 'especialidad_id' ? { medico_id: '' } : {}) }));
  const usarRapido = (tipo) => {
    const nuevos = { ...filtros, ...rango(tipo) };
    setFiltros(nuevos);
    generar(nuevos);
  };

  const medicosFiltrados = filtros.especialidad_id
    ? medicos.filter((m) => String(m.especialidad_id) === filtros.especialidad_id)
    : medicos;
  const maxMes = r ? Math.max(1, ...r.por_mes.map((m) => m.atendidos)) : 1;
  const maxMedico = r ? Math.max(1, ...r.por_medico.map((m) => m.atendidos)) : 1;

  return (
    <>
      <h1>Reportes</h1>
      <p className="suave">Pacientes atendidos por médico, totales y promedio mensual.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="panel">
        <div className="acciones" style={{ marginTop: 0 }}>
          {RAPIDOS.map(([tipo, texto]) => (
            <button key={tipo} className="boton-chico secundario" onClick={() => usarRapido(tipo)}>{texto}</button>
          ))}
        </div>
        <form className="filtros" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); generar(filtros); }}>
          <label className="campo">
            Desde
            <input type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} required />
          </label>
          <label className="campo">
            Hasta
            <input type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} required />
          </label>
          <label className="campo">
            Especialidad
            <select value={filtros.especialidad_id} onChange={(e) => cambiar('especialidad_id', e.target.value)}>
              <option value="">Todas</option>
              {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <label className="campo">
            Médico
            <select value={filtros.medico_id} onChange={(e) => cambiar('medico_id', e.target.value)}>
              <option value="">Todos</option>
              {medicosFiltrados.map((m) => (
                <option key={m.id} value={m.id}>{m.apellido}, {m.nombre}{m.activo ? '' : ' (de baja)'}</option>
              ))}
            </select>
          </label>
          <button className="boton" disabled={cargando}>{cargando ? 'Generando...' : 'Generar reporte'}</button>
          {r && (
            <button type="button" className="boton secundario" onClick={() => descargarCSV(r)}>
              <Download size={16} /> Descargar (Excel)
            </button>
          )}
        </form>
      </div>

      {r && (
        <>
          <p className="suave">
            Del {formatoFecha(r.desde)} al {formatoFecha(r.hasta)} · {r.meses} {r.meses === 1 ? 'mes' : 'meses'}
          </p>

          <div className="dato-cards">
            <div className="dato-card principal" style={tarjeta}>
              <span className="dato-titulo">Pacientes atendidos</span>
              <strong className="dato-grande">{r.totales.atendidos}</strong>
              <span className="suave">{r.totales.pacientes} personas distintas</span>
            </div>
            <div className="dato-card" style={tarjeta}>
              <span className="dato-titulo">Promedio mensual</span>
              <strong className="dato-grande">{numero(r.totales.promedio_mensual)}</strong>
              <span className="suave">atendidos por mes</span>
            </div>
            <div className="dato-card" style={tarjeta}>
              <span className="dato-titulo">Ausentismo</span>
              <strong className="dato-grande">{r.totales.ausentismo === null ? '—' : `${numero(r.totales.ausentismo)}%`}</strong>
              <span className="suave">{r.totales.ausentes} ausentes · {r.totales.cancelados} cancelados</span>
            </div>
          </div>
          {r.totales.sin_cerrar > 0 && (
            <p className="leyenda">
              Hay {r.totales.sin_cerrar} turno{r.totales.sin_cerrar === 1 ? '' : 's'} del período sin cerrar (pendientes, confirmados o en atención): no cuentan como atendidos.
            </p>
          )}

          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, flex: 1 }}>Atendidos por mes</h2>
              <button className="boton-chico secundario" onClick={() => setVerTabla((v) => !v)}>
                {verTabla ? 'Ver gráfico' : 'Ver como tabla'}
              </button>
            </div>
            {!verTabla ? (
              <div style={{ overflowX: 'auto' }}>
                <div
                  role="img" aria-label={`Atendidos por mes: ${r.por_mes.map((m) => `${nombreMes(m.mes)} ${m.atendidos}`).join(', ')}`}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 220, minWidth: r.por_mes.length * 44, padding: '28px 0 0', borderBottom: '1px solid var(--color-borde, #cbd5e1)', position: 'relative' }}
                >
                  {r.por_mes.map((m, i) => (
                    <div
                      key={m.mes}
                      onMouseEnter={() => setResaltado(i)} onMouseLeave={() => setResaltado(null)}
                      style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', cursor: 'default' }}
                    >
                      {resaltado === i && (
                        <div style={{ position: 'absolute', bottom: `calc(${(m.atendidos / maxMes) * 100}% + 8px)`, background: 'var(--color-texto, #0f172a)', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 1 }}>
                          {nombreMes(m.mes)}: <strong>{m.atendidos}</strong> atendidos · {m.ausentes} ausentes
                        </div>
                      )}
                      <div
                        style={{
                          width: '70%', maxWidth: 48, height: `${(m.atendidos / maxMes) * 100}%`, minHeight: m.atendidos ? 2 : 0,
                          background: 'var(--color-primario, #1d4ed8)', borderRadius: '4px 4px 0 0',
                          opacity: resaltado === null || resaltado === i ? 1 : 0.55, transition: 'opacity 120ms',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2, minWidth: r.por_mes.length * 44 }}>
                  {r.por_mes.map((m) => (
                    <span key={m.mes} className="suave" style={{ flex: 1, textAlign: 'center', fontSize: 12, paddingTop: 6 }}>{nombreMes(m.mes)}</span>
                  ))}
                </div>
                <p className="leyenda">Pasá el mouse por una barra para ver el número. El mes más alto: {Math.max(...r.por_mes.map((m) => m.atendidos))} atendidos.</p>
              </div>
            ) : (
              <table className="tabla">
                <thead><tr><th>Mes</th><th>Atendidos</th><th>Ausentes</th><th>Cancelados</th></tr></thead>
                <tbody>
                  {r.por_mes.map((m) => (
                    <tr key={m.mes}><td>{nombreMes(m.mes)}</td><td>{m.atendidos}</td><td>{m.ausentes}</td><td>{m.cancelados}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <h2>Por médico</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla">
                <thead>
                  <tr><th>Médico</th><th style={{ minWidth: 160 }}>Atendidos</th><th>Pacientes</th><th>Ausentes</th><th>Cancelados</th><th>Prom. mensual</th></tr>
                </thead>
                <tbody>
                  {r.por_medico.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.apellido}, {m.nombre}</strong>
                        <div className="suave">{m.especialidad}{m.activo ? '' : ' · de baja'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--color-fondo, #f4f6fb)', borderRadius: 4 }}>
                            <div style={{ width: `${(m.atendidos / maxMedico) * 100}%`, height: 8, background: 'var(--color-primario, #1d4ed8)', borderRadius: 4 }} />
                          </div>
                          <strong style={{ minWidth: 28, textAlign: 'right' }}>{m.atendidos}</strong>
                        </div>
                      </td>
                      <td>{m.pacientes}</td>
                      <td>{m.ausentes}</td>
                      <td>{m.cancelados}</td>
                      <td>{numero(m.promedio_mensual)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{r.totales.atendidos}</strong></td>
                    <td><strong>{r.totales.pacientes}</strong></td>
                    <td><strong>{r.totales.ausentes}</strong></td>
                    <td><strong>{r.totales.cancelados}</strong></td>
                    <td><strong>{numero(r.totales.promedio_mensual)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="leyenda">
              El promedio mensual divide los atendidos por la cantidad de meses del período (un mes incompleto cuenta entero).
              "Pacientes" son personas distintas: si alguien vino dos veces, cuenta una.
            </p>
          </div>

          {r.por_especialidad.length > 1 && (
            <div className="panel">
              <h2>Por especialidad</h2>
              <table className="tabla">
                <thead><tr><th>Especialidad</th><th>Atendidos</th><th>% del total</th></tr></thead>
                <tbody>
                  {r.por_especialidad.map((e) => (
                    <tr key={e.id}>
                      <td>{e.nombre}</td>
                      <td>{e.atendidos}</td>
                      <td>{numero(Math.round((e.atendidos * 1000) / r.totales.atendidos) / 10)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
