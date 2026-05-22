-- ============================================
-- DocPlant 🌱 - Esquema de Base de Datos
-- ============================================
-- Motor: PostgreSQL
-- Descripción: Esquema completo con tablas, índices y triggers

-- Función para actualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- Tabla: clients (Clientes/Usuarios)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    membership VARCHAR(50) NOT NULL DEFAULT 'free' CHECK(membership IN ('free', 'premium', 'admin')),
    daily_uploads_used INTEGER NOT NULL DEFAULT 0,
    last_upload_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- Tabla: sessions (Sesiones activas)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    ip_address VARCHAR(255),
    uploads_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- ============================================
-- Tabla: uploaded_files (Archivos subidos)
-- ============================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK(file_type IN ('template', 'content')),
    mime_type VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_processed INTEGER NOT NULL DEFAULT 0 CHECK(is_processed IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1))
);

-- ============================================
-- Tabla: generated_files (Archivos generados)
-- ============================================
CREATE TABLE IF NOT EXISTS generated_files (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    template_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE SET NULL,
    content_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE SET NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'docx' CHECK(format IN ('docx', 'pdf')),
    file_size INTEGER NOT NULL DEFAULT 0,
    file_path VARCHAR(500) NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_downloaded INTEGER NOT NULL DEFAULT 0 CHECK(is_downloaded IN (0, 1)),
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1))
);

-- ============================================
-- Tabla: invoices (Facturas/Pagos)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255) NOT NULL UNIQUE,
    paypal_order_id VARCHAR(255),
    paypal_payer_email VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'paypal',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    membership_type VARCHAR(50) NOT NULL DEFAULT 'premium',
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Índices para optimización de consultas
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_membership ON clients(membership);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_client_id ON uploaded_files(client_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_session_id ON uploaded_files(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);

CREATE INDEX IF NOT EXISTS idx_generated_files_client_id ON generated_files(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_files_session_id ON generated_files(session_id);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
