import ExcelJS from 'exceljs';
import { formatoFecha, hoyISO } from './fechas';

// Arma el reporte como un Excel de verdad (.xlsx): título, datos del período,
// y cada sección con su encabezado de color, bordes y totales en negrita.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

const VERDE = 'FF0B6E79'; // el color principal del sistema
const VERDE_CLARO = 'FFE6F2F3';
const GRIS = 'FFF1F5F9';
const BORDE = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const COLUMNAS = 7;

export async function descargarExcel(r, filtros) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'CAPS – Sistema de turnos';
  const hoja = libro.addWorksheet('Reporte', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.columns = [
    { width: 34 }, { width: 22 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 16 },
  ];

  // --- Título y datos del reporte ---
  const titulo = hoja.addRow(['Reporte de atención – CAPS']);
  hoja.mergeCells(titulo.number, 1, titulo.number, COLUMNAS);
  titulo.font = { bold: true, size: 16, color: { argb: VERDE } };
  titulo.height = 26;

  const dato = (etiqueta, valor) => {
    const fila = hoja.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
    hoja.mergeCells(fila.number, 2, fila.number, COLUMNAS);
  };
  dato('Período', `Del ${formatoFecha(r.desde)} al ${formatoFecha(r.hasta)} (${r.meses} ${r.meses === 1 ? 'mes' : 'meses'})`);
  dato('Especialidad', filtros.especialidad || 'Todas');
  dato('Médico', filtros.medico || 'Todos');
  dato('Generado el', formatoFecha(hoyISO()));
  hoja.addRow([]);

  // --- Ayudantes para las secciones ---
  const seccion = (texto) => {
    const fila = hoja.addRow([texto]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    fila.font = { bold: true, size: 13, color: { argb: VERDE } };
    fila.height = 20;
  };
  const encabezado = (titulos) => {
    const fila = hoja.addRow(titulos);
    titulos.forEach((_, i) => {
      const c = fila.getCell(i + 1);
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true };
      c.border = BORDES;
    });
    fila.height = 30;
  };
  const filaDatos = (valores, { total = false, rayada = false, formatos = {} } = {}) => {
    const fila = hoja.addRow(valores);
    valores.forEach((_, i) => {
      const c = fila.getCell(i + 1);
      c.border = BORDES;
      c.alignment = { horizontal: i === 0 || (i === 1 && typeof valores[1] === 'string') ? 'left' : 'center' };
      if (formatos[i]) c.numFmt = formatos[i];
      if (total) {
        c.font = { bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
      } else if (rayada) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
      }
    });
  };
  const nota = (texto) => {
    const fila = hoja.addRow([texto]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    fila.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    fila.alignment = { wrapText: true, vertical: 'top' };
    fila.height = 28;
  };
  const porcentaje = (n) => (n === null || n === undefined ? '—' : n / 100);
  const UN_DECIMAL = '0.0';
  const PORC = '0.0%';

  // --- 1. Resumen ---
  const t = r.totales;
  seccion('1. Resumen del período');
  encabezado(['Indicador', 'Valor']);
  const resumen = [
    ['Pacientes atendidos', t.atendidos],
    ['Personas distintas atendidas', t.pacientes],
    ['Promedio mensual de atendidos', t.promedio_mensual, UN_DECIMAL],
    ['Ausentes', t.ausentes],
    ['Cancelados', t.cancelados],
    ['Ausentismo', porcentaje(t.ausentismo), PORC],
  ];
  if (t.sin_cerrar > 0) resumen.push(['Turnos sin cerrar (no cuentan como atendidos)', t.sin_cerrar]);
  resumen.forEach(([etiqueta, valor, fmt], i) => {
    filaDatos([etiqueta, valor], { rayada: i % 2 === 1, formatos: fmt ? { 1: fmt } : {} });
  });
  nota('Ausentismo = ausentes sobre (atendidos + ausentes). Los cancelados no cuentan porque el horario quedó libre.');
  hoja.addRow([]);

  // --- 2. Por médico ---
  seccion('2. Atención por médico');
  encabezado(['Médico', 'Especialidad', 'Atendidos', 'Pacientes distintos', 'Ausentes', 'Cancelados', 'Promedio mensual']);
  r.por_medico.forEach((m, i) => {
    filaDatos(
      [`${m.apellido}, ${m.nombre}${m.activo ? '' : ' (de baja)'}`, m.especialidad, m.atendidos, m.pacientes, m.ausentes, m.cancelados, m.promedio_mensual],
      { rayada: i % 2 === 1, formatos: { 6: UN_DECIMAL } }
    );
  });
  filaDatos(['TOTAL', '', t.atendidos, t.pacientes, t.ausentes, t.cancelados, t.promedio_mensual], { total: true, formatos: { 6: UN_DECIMAL } });
  nota('"Pacientes distintos" son personas: si alguien vino dos veces, cuenta una. El promedio mensual divide los atendidos por la cantidad de meses del período (un mes incompleto cuenta entero).');
  hoja.addRow([]);

  // --- 3. Por especialidad ---
  if (r.por_especialidad.length > 0) {
    seccion('3. Atención por especialidad');
    encabezado(['Especialidad', 'Atendidos', '% del total']);
    r.por_especialidad.forEach((e, i) => {
      filaDatos([e.nombre, e.atendidos, t.atendidos ? e.atendidos / t.atendidos : '—'], { rayada: i % 2 === 1, formatos: { 2: PORC } });
    });
    filaDatos(['TOTAL', t.atendidos, t.atendidos ? 1 : '—'], { total: true, formatos: { 2: PORC } });
    hoja.addRow([]);
  }

  // --- 4. Por mes ---
  seccion(`${r.por_especialidad.length > 0 ? 4 : 3}. Atención mes a mes`);
  encabezado(['Mes', 'Atendidos', 'Ausentes', 'Cancelados']);
  r.por_mes.forEach((m, i) => {
    filaDatos([nombreMes(m.mes), m.atendidos, m.ausentes, m.cancelados], { rayada: i % 2 === 1 });
  });
  filaDatos(['TOTAL', t.atendidos, t.ausentes, t.cancelados], { total: true });

  // --- Descargar ---
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${r.desde}-a-${r.hasta}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
