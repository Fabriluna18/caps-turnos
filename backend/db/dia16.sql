-- Día 16: atención médica (una por turno). Al finalizarla queda cerrada: las correcciones van como notas.
CREATE TABLE IF NOT EXISTS atenciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  turno_id INT UNSIGNED NOT NULL,
  medico_id INT UNSIGNED NOT NULL,
  paciente_id INT UNSIGNED NOT NULL,
  motivo_consulta VARCHAR(300) NULL,
  presion_sistolica SMALLINT UNSIGNED NULL,
  presion_diastolica SMALLINT UNSIGNED NULL,
  frecuencia_cardiaca SMALLINT UNSIGNED NULL,
  temperatura DECIMAL(4,1) NULL,
  saturacion TINYINT UNSIGNED NULL,
  peso_kg DECIMAL(5,1) NULL,
  talla_cm SMALLINT UNSIGNED NULL,
  examen_fisico VARCHAR(2000) NULL,
  diagnostico VARCHAR(300) NULL,
  indicaciones VARCHAR(2000) NULL,
  finalizada TINYINT(1) NOT NULL DEFAULT 0,
  finalizada_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_atenciones_turno (turno_id),
  KEY idx_atenciones_paciente (paciente_id, id),
  CONSTRAINT fk_atenciones_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE RESTRICT,
  CONSTRAINT fk_atenciones_medico FOREIGN KEY (medico_id) REFERENCES medicos (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT fk_atenciones_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (usuario_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atencion_notas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  atencion_id INT UNSIGNED NOT NULL,
  texto VARCHAR(1000) NOT NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_atencion_notas (atencion_id),
  CONSTRAINT fk_atencion_notas_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones (id) ON DELETE RESTRICT,
  CONSTRAINT fk_atencion_notas_autor FOREIGN KEY (creado_por) REFERENCES medicos (usuario_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
