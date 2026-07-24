-- Tabla de usuarios (login y roles)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user'))
);

-- Tabla de colaboradores (empleados)
CREATE TABLE IF NOT EXISTS collaborators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    photo TEXT NOT NULL DEFAULT '',
    role_id TEXT,
    document TEXT
);

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Tabla de registros de asistencia
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    collaborator_id TEXT NOT NULL,
    collaborator_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('entry', 'exit')),
    captured_photo_url TEXT
);

-- Tabla de turnos
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#34D399'
);

-- Tabla de horarios/asignaciones
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    collaborator_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'present', 'absent', 'late', 'on_leave'))
);

-- Tabla de patrones de turnos
CREATE TABLE IF NOT EXISTS shift_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sequence TEXT NOT NULL -- JSON array de shift IDs o null (días de descanso)
);

-- Tabla de visitas
CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    gov_id TEXT NOT NULL,
    company TEXT NOT NULL,
    signature_url TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- Insertar usuario admin por defecto (password: admin123)
INSERT OR IGNORE INTO users (id, name, email, password, role)
VALUES ('admin', 'Administrador', 'admin@timeface.com', 'admin123', 'admin');