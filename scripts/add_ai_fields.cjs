const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.VITE_TURSO_DATABASE_URL;
const dbToken = process.env.VITE_TURSO_AUTH_TOKEN;

if (!dbUrl || !dbToken) {
  console.error('Error: VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN must be set in .env');
  process.exit(1);
}

const turso = createClient({
  url: dbUrl,
  authToken: dbToken,
});

async function runMigration() {
  console.log('Iniciando migración para agregar campos de IA...');

  try {
    console.log('Agregando columna spoof_status...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN spoof_status TEXT DEFAULT 'UNCHECKED'`);
    
    console.log('Agregando columna wellness_status...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN wellness_status TEXT DEFAULT 'UNCHECKED'`);
    
    console.log('Agregando columna ai_analysis_reason...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN ai_analysis_reason TEXT`);
    
    console.log('Migración completada exitosamente. Las columnas han sido agregadas.');
  } catch (error) {
    if (error.message && error.message.includes('duplicate column name')) {
      console.log('Las columnas ya existen en la base de datos.');
    } else {
      console.error('Error durante la migración:', error);
    }
  }
}

runMigration();
