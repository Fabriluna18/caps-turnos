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