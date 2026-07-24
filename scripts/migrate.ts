import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TURSO_URL = process.env.TURSO_URL || 'libsql://nominai-pauloperez.aws-us-east-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ4NjExNDcsImlkIjoiMDE5ZjkyMDItZWEwMS03OGI0LWFlMjctMmY5NTExNjExYmYxIiwia2lkIjoiZjlnY09MVnU5dDJqQ0ozM0x1dFdkTTFIeFhlR3dJUVFIZ19KZ2dSZkwyayIsInJpZCI6IjVjNmZmMDM5LThjNDMtNGE4MS1iYzdkLWY2MGEwNjVkODk3OSJ9.iTvd4Ck5RhNIXsPvvVcf6tido9akI2bID494IkI0gv7fODlKR5uHqtE1BxoWdUpOXwmHF7DVF-A2pfPPWMa_Bg';

async function migrate() {
    const turso = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
    });

    const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const statements = schema
        .split(';')
        .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
        .filter(s => s.length > 0)
        .map(s => s + ';');

    for (const stmt of statements) {
        try {
            await turso.execute(stmt);
            console.log(`OK: ${stmt.substring(0, 60)}...`);
        } catch (err: any) {
            console.error(`ERROR: ${stmt.substring(0, 60)}...`);
            console.error(err.message);
        }
    }

    console.log('Migración completada');
    process.exit(0);
}

migrate();