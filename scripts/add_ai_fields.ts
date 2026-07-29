import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
    // Agregamos spoof_status
    console.log('Agregando columna spoof_status...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN spoof_status TEXT DEFAULT 'UNCHECKED'`);
    
    // Agregamos wellness_status
    console.log('Agregando columna wellness_status...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN wellness_status TEXT DEFAULT 'UNCHECKED'`);
    
    // Agregamos ai_analysis_reason
    console.log('Agregando columna ai_analysis_reason...');
    await turso.execute(`ALTER TABLE attendance_records ADD COLUMN ai_analysis_reason TEXT`);
    
    console.log('Migración completada exitosamente. Las columnas han sido agregadas.');
  } catch (error) {
    // Si la columna ya existe, SQLite lanzará un error que podemos ignorar
    if (error instanceof Error && error.message.includes('duplicate column name')) {
      console.log('Las columnas ya existen en la base de datos.');
    } else {
      console.error('Error durante la migración:', error);
    }
  }
}

runMigration();
