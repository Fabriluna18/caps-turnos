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
