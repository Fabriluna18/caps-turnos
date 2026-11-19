USE caps_turnos;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dni VARCHAR(8) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  email VARCHAR(150) NULL,
  telefono VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('secretaria', 'medico', 'paciente') NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  debe_cambiar_clave TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_dni (dni),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS especialidades (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_especialidades_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO especialidades (nombre) VALUES
  ('Clínica médica'), ('Pediatría'), ('Ginecología'), ('Traumatología'), ('Odontología');

CREATE TABLE IF NOT EXISTS medicos (
  usuario_id INT UNSIGNED PRIMARY KEY,
  matricula VARCHAR(20) NOT NULL,
  especialidad_id INT UNSIGNED NOT NULL,
  CONSTRAINT fk_medicos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_medicos_especialidad FOREIGN KEY (especialidad_id) REFERENCES especialidades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pacientes (
  usuario_id INT UNSIGNED PRIMARY KEY,
  fecha_nacimiento DATE NULL,
  direccion VARCHAR(150) NULL,
  localidad VARCHAR(80) NULL,
  cobertura VARCHAR(80) NULL,
  CONSTRAINT fk_pacientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recuperaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_en DATETIME NOT NULL,
  usado_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recuperaciones_hash (token_hash),
  KEY idx_recuperaciones_usuario (usuario_id),
  CONSTRAINT fk_recuperaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE medicos ADD UNIQUE INDEX IF NOT EXISTS uq_medicos_matricula (matricula);

-- Día 5: horarios de atención, licencias y feriados
CREATE TABLE IF NOT EXISTS horarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_min SMALLINT UNSIGNED NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_horarios_medico_dia (medico_id, dia_semana),
  CONSTRAINT fk_horarios_medico FOREIGN KEY (medico_id) REFERENCES medicos (usuario_id) ON DELETE CASCADE,
  CONSTRAINT chk_horarios_dia CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT chk_horarios_horas CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS licencias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  motivo VARCHAR(100) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_licencias_medico (medico_id, desde, hasta),
  CONSTRAINT fk_licencias_medico FOREIGN KEY (medico_id) REFERENCES medicos (usuario_id) ON DELETE CASCADE,
  CONSTRAINT chk_licencias_fechas CHECK (hasta >= desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feriados (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_feriados_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Día 7: turnos (las reservas se arman el Día 8)
CREATE TABLE IF NOT EXISTS turnos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medico_id INT UNSIGNED NOT NULL,
  paciente_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  duracion_min SMALLINT UNSIGNED NOT NULL,
  estado ENUM('pendiente', 'confirmado', 'en_atencion', 'atendido', 'cancelado', 'ausente') NOT NULL DEFAULT 'pendiente',
  motivo VARCHAR(150) NULL,
  creado_por INT UNSIGNED NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_en DATETIME NULL,
  -- Vale 1 mientras el turno ocupa el horario y NULL si se canceló: así la cancelación lo libera
  slot_ocupado TINYINT AS (IF(estado = 'cancelado', NULL, 1)) PERSISTENT,
  UNIQUE KEY uq_turnos_slot (medico_id, fecha, hora, slot_ocupado),
  KEY idx_turnos_paciente (paciente_id, fecha),
  KEY idx_turnos_medico_fecha (medico_id, fecha),
  CONSTRAINT fk_turnos_medico FOREIGN KEY (medico_id) REFERENCES medicos (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT fk_turnos_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT fk_turnos_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_turnos_duracion CHECK (duracion_min > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Día 8: nada se borra, solo se desactiva
ALTER TABLE especialidades ADD COLUMN IF NOT EXISTS activa TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS activo TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE licencias ADD COLUMN IF NOT EXISTS activa TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE feriados ADD COLUMN IF NOT EXISTS activo TINYINT(1) NOT NULL DEFAULT 1;

-- Día 8 (parte 2): los horarios eliminados quedan guardados, solo se ocultan de la lista
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS eliminado TINYINT(1) NOT NULL DEFAULT 0;

-- Día 10: confirmación de turnos por enlace + recordatorios
CREATE TABLE IF NOT EXISTS confirmaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  turno_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usado_en DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_confirmaciones_token (token_hash),
  KEY idx_confirmaciones_turno (turno_id),
  CONSTRAINT fk_confirmaciones_turno FOREIGN KEY (turno_id) REFERENCES turnos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE turnos ADD COLUMN IF NOT EXISTS recordatorio_enviado_en DATETIME NULL;

-- Día 13: recetas (no se borran ni se editan: se anulan)
CREATE TABLE IF NOT EXISTS recetas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  turno_id INT UNSIGNED NOT NULL,
  medico_id INT UNSIGNED NOT NULL,
  paciente_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  diagnostico VARCHAR(200) NULL,
  indicaciones VARCHAR(1000) NULL,
  anulada TINYINT(1) NOT NULL DEFAULT 0,
  anulada_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recetas_paciente (paciente_id, fecha),
  KEY idx_recetas_medico (medico_id, fecha),
  KEY idx_recetas_turno (turno_id),
  CONSTRAINT fk_recetas_turno FOREIGN KEY (turno_id) REFERENCES turnos (id) ON DELETE RESTRICT,
  CONSTRAINT fk_recetas_medico FOREIGN KEY (medico_id) REFERENCES medicos (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT fk_recetas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (usuario_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS receta_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  receta_id INT UNSIGNED NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  medicamento VARCHAR(150) NOT NULL,
  presentacion VARCHAR(100) NULL,
  dosis VARCHAR(150) NOT NULL,
  cantidad VARCHAR(50) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receta_items_orden (receta_id, orden),
  CONSTRAINT fk_receta_items_receta FOREIGN KEY (receta_id) REFERENCES recetas (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Día 15: ficha clínica. Nunca se pisa: cada cambio guarda una versión nueva.
CREATE TABLE IF NOT EXISTS fichas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  paciente_id INT UNSIGNED NOT NULL,
  grupo_sanguineo VARCHAR(3) NULL,
  alergias VARCHAR(500) NULL,
  enfermedades VARCHAR(500) NULL,
  medicacion VARCHAR(500) NULL,
  antecedentes_personales VARCHAR(1000) NULL,
  antecedentes_familiares VARCHAR(1000) NULL,
  creado_por INT UNSIGNED NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fichas_paciente (paciente_id, id),
  CONSTRAINT fk_fichas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT fk_fichas_autor FOREIGN KEY (creado_por) REFERENCES medicos (usuario_id) ON DELETE RESTRICT,
  CONSTRAINT chk_fichas_grupo CHECK (grupo_sanguineo IS NULL OR grupo_sanguineo IN ('A+','A-','B+','B-','AB+','AB-','0+','0-'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


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


-- Día 19: al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos
-- (guarda el momento del cambio en segundos; los ingresos anteriores dejan de valer)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesiones_desde INT UNSIGNED NOT NULL DEFAULT 0;
