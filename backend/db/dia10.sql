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
