import ExcelJS from 'exceljs';
import { formatoFecha, hoyISO } from './fechas';

// Arma el reporte como un Excel de verdad (.xlsx). Pedido de la ingeniera: con título,
// ordenado y más visual. Tiene dos hojas:
//  1. "Reporte": banda de título, datos del período, números principales en grande,
//     y cada sección numerada con su tabla (ordenada de más a menos) y barras de datos.
//  2. "Médicos (filtrable)": la misma tabla por médico con los filtros de Excel puestos.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// Los colores del sistema
const VERDE = 'FF0B6E79';
const VERDE_OSCURO = 'FF08525A';
const VERDE_CLARO = 'FFE6F3F4';
const GRIS = 'FFF8FAFC';
const GRIS_TEXTO = 'FF64748B';
const BLANCO = 'FFFFFFFF';
const BORDE = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const COLUMNAS = 7;
const UN_DECIMAL = '0.0';
const PORC = '0.0%';

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const letra = (n) => String.fromCharCode(64 + n); // 1 -> A

export async function descargarExcel(r, filtros) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'CAPS – Sistema de turnos';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Reporte', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: '&L&8CAPS – Sistema de turnos&R&8Página &P de &N' },
  });
  hoja.columns = [{ width: 36 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }];
  const t = r.totales;

  // ---------- Banda de título ----------
  const banda = (texto, { alto, tamano, fondo, negrita = true }) => {
    const fila = hoja.addRow([texto]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    const c = fila.getCell(1);
    c.font = { bold: negrita, size: tamano, color: { argb: BLANCO } };
    c.fill = relleno(fondo);
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    fila.height = alto;
  };
  banda('Reporte de atención', { alto: 36, tamano: 20, fondo: VERDE });
  banda('Centro de Atención Primaria de la Salud (CAPS) – Sistema de turnos', { alto: 22, tamano: 11, fondo: VERDE_OSCURO, negrita: false });
  hoja.addRow([]);

  // ---------- Datos del reporte (etiqueta con fondo + valor) ----------
  const dato = (etiqueta, valor) => {
    const fila = hoja.addRow([etiqueta, valor]);
    hoja.mergeCells(fila.number, 2, fila.number, COLUMNAS);
    const e = fila.getCell(1);
    e.font = { bold: true, color: { argb: VERDE_OSCURO } };
    e.fill = relleno(VERDE_CLARO);
    e.border = BORDES;
    e.alignment = { indent: 1 };
    const v = fila.getCell(2);
    v.border = BORDES;
    v.alignment = { indent: 1 };
  };
  dato('Período', `Del ${formatoFecha(r.desde)} al ${formatoFecha(r.hasta)} (${r.meses} ${r.meses === 1 ? 'mes' : 'meses'})`);
  dato('Especialidad', filtros.especialidad || 'Todas');
  dato('Médico', filtros.medico || 'Todos');
  dato('Generado el', formatoFecha(hoyISO()));
  hoja.addRow([]);

  // ---------- Números principales, en grande ----------
  // Cada tarjeta ocupa unas columnas: [desde, hasta, título, valor, formato, aclaración]
  const tarjetas = [
    [1, 1, 'PACIENTES ATENDIDOS', t.atendidos, '0', `${t.pacientes} personas distintas`],
    [2, 2, 'PROMEDIO MENSUAL', t.promedio_mensual, UN_DECIMAL, 'atendidos por mes'],
    [3, 4, 'AUSENTISMO', t.ausentismo === null ? '—' : t.ausentismo / 100, PORC, `${t.ausentes} ausentes`],
    [5, 7, 'CANCELADOS', t.cancelados, '0', 'el horario quedó libre'],
  ];
  const filaTit = hoja.addRow([]);
  const filaVal = hoja.addRow([]);
  const filaAcl = hoja.addRow([]);
  filaTit.height = 20;
  filaVal.height = 34;
  filaAcl.height = 18;
  for (const [ini, fin, titulo, valor, formato, aclaracion] of tarjetas) {
    for (const [fila, contenido] of [[filaTit, titulo], [filaVal, valor], [filaAcl, aclaracion]]) {
      if (fin > ini) hoja.mergeCells(fila.number, ini, fila.number, fin);
      const c = fila.getCell(ini);
      c.value = contenido;
      c.fill = relleno(ini === 1 ? VERDE : VERDE_CLARO);
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      const color = ini === 1 ? BLANCO : fila === filaVal ? VERDE_OSCURO : GRIS_TEXTO;
      if (fila === filaTit) c.font = { bold: true, size: 9, color: { argb: ini === 1 ? BLANCO : GRIS_TEXTO } };
      if (fila === filaVal) {
        c.font = { bold: true, size: 22, color: { argb: color } };
        if (typeof contenido === 'number') c.numFmt = formato;
      }
      if (fila === filaAcl) c.font = { size: 9, color: { argb: color } };
      // Bordes blancos gruesos entre tarjetas, así se ven separadas
      const blanco = { style: 'thick', color: { argb: BLANCO } };
      c.border = { left: blanco, right: blanco };
    }
  }
  if (t.sin_cerrar > 0) {
    const fila = hoja.addRow([`Atención: hay ${t.sin_cerrar} turnos del período sin cerrar (pendientes, confirmados o en atención). No cuentan como atendidos.`]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    fila.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
  }
  hoja.addRow([]);

  // ---------- Ayudantes para las secciones ----------
  let numero = 0;
  const seccion = (texto) => {
    numero += 1;
    hoja.addRow([]);
    const fila = hoja.addRow([`${numero}.  ${texto}`]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    const c = fila.getCell(1);
    c.font = { bold: true, size: 13, color: { argb: VERDE_OSCURO } };
    c.border = { bottom: { style: 'medium', color: { argb: VERDE } } };
    fila.height = 24;
    hoja.addRow([]).height = 6;
  };
  const encabezado = (titulos) => {
    const fila = hoja.addRow(titulos);
    titulos.forEach((_, i) => {
      const c = fila.getCell(i + 1);
      c.font = { bold: true, color: { argb: BLANCO } };
      c.fill = relleno(VERDE);
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', wrapText: true, indent: i === 0 ? 1 : 0 };
      c.border = BORDES;
    });
    fila.height = 30;
    return fila.number;
  };
  const filaDatos = (valores, { total = false, rayada = false, formatos = {} } = {}) => {
    const fila = hoja.addRow(valores);
    valores.forEach((_, i) => {
      const c = fila.getCell(i + 1);
      c.border = BORDES;
      const texto = i === 0 || (i === 1 && typeof valores[1] === 'string');
      c.alignment = { horizontal: texto ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
      if (formatos[i]) c.numFmt = formatos[i];
      if (total) {
        c.font = { bold: true, color: { argb: VERDE_OSCURO } };
        c.fill = relleno(VERDE_CLARO);
        c.border = { ...BORDES, top: { style: 'medium', color: { argb: VERDE } } };
      } else if (rayada) {
        c.fill = relleno(GRIS);
      }
    });
    fila.height = 20;
    return fila.number;
  };
  const nota = (texto) => {
    const fila = hoja.addRow([texto]);
    hoja.mergeCells(fila.number, 1, fila.number, COLUMNAS);
    fila.font = { italic: true, size: 9, color: { argb: GRIS_TEXTO } };
    fila.alignment = { wrapText: true, vertical: 'top' };
    fila.height = 28;
  };
  // Barra de datos dentro de las celdas (como un gráfico chiquito)
  const barras = (columna, desde, hasta) => {
    if (hasta < desde) return;
    hoja.addConditionalFormatting({
      ref: `${letra(columna)}${desde}:${letra(columna)}${hasta}`,
      rules: [{ type: 'dataBar', gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF7FC4CB' } }],
    });
  };

  // ---------- Atención por médico (de más a menos atendidos) ----------
  const porMedico = [...r.por_medico].sort((a, b) => b.atendidos - a.atendidos || a.apellido.localeCompare(b.apellido, 'es'));
  seccion('Atención por médico (de más a menos atendidos)');
  encabezado(['Médico', 'Especialidad', 'Atendidos', 'Pacientes distintos', 'Ausentes', 'Cancelados', 'Promedio mensual']);
  let primera = 0;
  let ultima = 0;
  porMedico.forEach((m, i) => {
    const n = filaDatos(
      [`${m.apellido}, ${m.nombre}${m.activo ? '' : ' (de baja)'}`, m.especialidad, m.atendidos, m.pacientes, m.ausentes, m.cancelados, m.promedio_mensual],
      { rayada: i % 2 === 1, formatos: { 6: UN_DECIMAL } }
    );
    if (i === 0) primera = n;
    ultima = n;
  });
  barras(3, primera, ultima);
  filaDatos(['TOTAL', '', t.atendidos, t.pacientes, t.ausentes, t.cancelados, t.promedio_mensual], { total: true, formatos: { 6: UN_DECIMAL } });
  nota('"Pacientes distintos" son personas: si alguien vino dos veces, cuenta una. El promedio mensual divide los atendidos por la cantidad de meses del período (un mes incompleto cuenta entero).');

  // ---------- Atención por especialidad (de más a menos) ----------
  if (r.por_especialidad.length > 0) {
    const porEsp = [...r.por_especialidad].sort((a, b) => b.atendidos - a.atendidos);
    seccion('Atención por especialidad (de más a menos atendidos)');
    encabezado(['Especialidad', 'Atendidos', '% del total']);
    porEsp.forEach((e, i) => {
      const n = filaDatos([e.nombre, e.atendidos, t.atendidos ? e.atendidos / t.atendidos : '—'], { rayada: i % 2 === 1, formatos: { 2: PORC } });
      if (i === 0) primera = n;
      ultima = n;
    });
    barras(2, primera, ultima);
    filaDatos(['TOTAL', t.atendidos, t.atendidos ? 1 : '—'], { total: true, formatos: { 2: PORC } });
  }

  // ---------- Mes a mes (en orden de fecha) ----------
  seccion('Atención mes a mes');
  encabezado(['Mes', 'Atendidos', 'Ausentes', 'Cancelados', 'Ausentismo']);
  r.por_mes.forEach((m, i) => {
    const base = m.atendidos + m.ausentes;
    const n = filaDatos([nombreMes(m.mes), m.atendidos, m.ausentes, m.cancelados, base ? m.ausentes / base : '—'], { rayada: i % 2 === 1, formatos: { 4: PORC } });
    if (i === 0) primera = n;
    ultima = n;
  });
  barras(2, primera, ultima);
  filaDatos(['TOTAL', t.atendidos, t.ausentes, t.cancelados, t.ausentismo === null ? '—' : t.ausentismo / 100], { total: true, formatos: { 4: PORC } });
  nota('Ausentismo = ausentes sobre (atendidos + ausentes). Los cancelados no cuentan porque el horario quedó libre.');

  // ---------- Hoja 2: médicos con los filtros de Excel ----------
  const hoja2 = libro.addWorksheet('Médicos (filtrable)', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja2.columns = [
    { header: 'Médico', width: 30 }, { header: 'Especialidad', width: 20 }, { header: 'Estado', width: 10 },
    { header: 'Atendidos', width: 12 }, { header: 'Pacientes distintos', width: 12 }, { header: 'Ausentes', width: 11 },
    { header: 'Cancelados', width: 11 }, { header: 'Promedio mensual', width: 12 },
  ];
  const cab = hoja2.getRow(1);
  cab.height = 30;
  cab.eachCell((c) => {
    c.font = { bold: true, color: { argb: BLANCO } };
    c.fill = relleno(VERDE);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = BORDES;
  });
  porMedico.forEach((m) => {
    const fila = hoja2.addRow([`${m.apellido}, ${m.nombre}`, m.especialidad, m.activo ? 'Activo' : 'De baja', m.atendidos, m.pacientes, m.ausentes, m.cancelados, m.promedio_mensual]);
    fila.eachCell((c) => { c.border = BORDES; });
    fila.getCell(8).numFmt = UN_DECIMAL;
  });
  hoja2.autoFilter = { from: 'A1', to: `H${porMedico.length + 1}` };

  // ---------- Descargar ----------
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${r.desde}-a-${r.hasta}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
