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