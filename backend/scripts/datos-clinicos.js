// Casos clínicos de ejemplo (TODO FICTICIO), por especialidad: [motivo, diagnóstico, medicamentos posibles]
// Los usan crear-datos-ejemplo.js y crear-historial-demo.js.
const CLINICA = {
  'Clínica médica': [
    ['Control de presión', 'Hipertensión arterial controlada', [['Enalapril', '10 mg comprimidos', '1 por día', '1 caja']]],
    ['Dolor de garganta', 'Faringitis aguda', [['Ibuprofeno', '400 mg comprimidos', '1 cada 8 horas por 5 días', '1 caja']]],
    ['Control anual', 'Examen de salud sin hallazgos', []],
    ['Dolor de cabeza', 'Cefalea tensional', [['Paracetamol', '500 mg comprimidos', '1 cada 8 horas si hay dolor', '1 caja']]],
    ['Tos y fiebre', 'Infección respiratoria alta', [['Paracetamol', '500 mg comprimidos', '1 cada 6 horas si hay fiebre', '1 caja']]],
    ['Control de diabetes', 'Diabetes tipo 2 en tratamiento', [['Metformina', '850 mg comprimidos', '1 con almuerzo y cena', '2 cajas']]],
  ],
  Pediatría: [
    ['Control de niño sano', 'Crecimiento y desarrollo normales', []],
    ['Fiebre', 'Síndrome febril', [['Ibuprofeno', 'Suspensión 2%', 'Según peso, cada 8 horas', '1 frasco']]],
    ['Tos', 'Bronquiolitis leve', [['Salbutamol', 'Aerosol 100 mcg', '2 disparos cada 6 horas', '1 aerosol']]],
    ['Vacunas', 'Calendario de vacunación al día', []],
    ['Dolor de oído', 'Otitis media aguda', [['Amoxicilina', 'Suspensión 500 mg/5 ml', 'Cada 8 horas por 7 días', '1 frasco']]],
  ],
  Ginecología: [
    ['Control anual', 'Control ginecológico normal', []],
    ['Control de embarazo', 'Embarazo de curso normal', [['Ácido fólico', '1 mg comprimidos', '1 por día', '1 caja']]],
    ['Consulta por anticoncepción', 'Asesoramiento anticonceptivo', []],
    ['Flujo y ardor', 'Vulvovaginitis', [['Clotrimazol', 'Óvulos 500 mg', '1 óvulo dosis única', '1 caja']]],
  ],
  Odontología: [
    ['Dolor de muela', 'Caries profunda', [['Ibuprofeno', '400 mg comprimidos', '1 cada 8 horas por 3 días', '1 caja']]],
    ['Control', 'Control odontológico sin hallazgos', []],
    ['Limpieza', 'Gingivitis leve', [['Clorhexidina', 'Colutorio 0,12%', 'Buches 2 veces por día por 10 días', '1 frasco']]],
    ['Encía inflamada', 'Absceso periodontal', [['Amoxicilina', '500 mg cápsulas', '1 cada 8 horas por 7 días', '1 caja']]],
  ],
};

module.exports = { CLINICA };
