import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api/client';
import { mensajeDeError } from '../api/errores';
import { hoyISO } from '../fechas';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// soloConTurnos: si es true, los días sin turnos libres no se pueden elegir
export default function CalendarioDisponibilidad({ medicoId, fechaElegida, onElegir, soloConTurnos = false, version = 0 }) {
  const hoy = hoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [datos, setDatos] = useState({ clave: '', dias: {} });
  const [error, setError] = useState('');

  const clave = `${medicoId}|${anio}-${String(mes).padStart(2, '0')}|${version}`;
  const cargando = datos.clave !== clave;

  useEffect(() => {
    let vigente = true;
    const parametro = `${anio}-${String(mes).padStart(2, '0')}`;
    apiFetch(`/disponibilidad/mes?medico_id=${medicoId}&mes=${parametro}`)
      .then((r) => {
        if (!vigente) return;
        setDatos({ clave, dias: Object.fromEntries(r.dias.map((d) => [d.fecha, d])) });
        setError('');
      })
      .catch((err) => {
        if (vigente) setError(mensajeDeError(err));
      });
    return () => {
      vigente = false;
    };
  }, [medicoId, anio, mes, version, clave]);

  const indiceMes = anio * 12 + mes;
  const indiceHoy = Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7));

  const moverMes = (delta) => {
    const n = indiceMes + delta - 1;
    setAnio(Math.floor(n / 12));
    setMes((n % 12) + 1);
  };

  const desfase = (new Date(anio, mes - 1, 1).getDay() + 6) % 7; // la semana arranca en lunes
  const total = new Date(anio, mes, 0).getDate();
  const celdas = [...Array(desfase).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <div className="panel">
      <div className="cal-cab">
        <h2>{MESES[mes - 1]} {anio}</h2>
        <div className="cal-nav">
          <button onClick={() => moverMes(-1)} disabled={indiceMes <= indiceHoy} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => moverMes(1)} disabled={indiceMes >= indiceHoy + 2} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="cal-grilla" aria-busy={cargando}>
        {SEMANA.map((d) => (
          <div key={d} className="cal-semana">{d}</div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} />;
          const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          const info = cargando ? null : datos.dias[fecha];
          const libres = info ? info.libres : 0;
          const clases = ['cal-dia'];
          if (libres > 0) clases.push('con');
          if (fecha === hoy) clases.push('hoy');
          if (fecha === fechaElegida) clases.push('elegido');
          return (
            <button
              key={fecha} type="button" className={clases.join(' ')}
              disabled={cargando || (soloConTurnos && libres === 0)}
              onClick={() => onElegir(fecha)}
              aria-label={`${dia} de ${MESES[mes - 1]}: ${libres} turnos libres`}
            >
              <span>{dia}</span>
              {libres > 0 && <small className="cantidad">{libres}</small>}
            </button>
          );
        })}
      </div>

      <p className="leyenda">Los días en verde tienen turnos libres. El número indica cuántos.</p>
    </div>
  );
}