import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL || 'libsql://nominai-pauloperez.aws-us-east-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ4NjExNDcsImlkIjoiMDE5ZjkyMDItZWEwMS03OGI0LWFlMjctMmY5NTExNjExYmYxIiwia2lkIjoiZjlnY09MVnU5dDJqQ0ozM0x1dFdkTTFIeFhlR3dJUVFIZ19KZ2dSZkwyayIsInJpZCI6IjVjNmZmMDM5LThjNDMtNGE4MS1iYzdkLWY2MGEwNjVkODk3OSJ9.iTvd4Ck5RhNIXsPvvVcf6tido9akI2bID494IkI0gv7fODlKR5uHqtE1BxoWdUpOXwmHF7DVF-A2pfPPWMa_Bg';

async function migrate() {
    const turso = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
    });

    try {
        await turso.execute(`
            CREATE TABLE IF NOT EXISTS known_locations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                radius REAL NOT NULL DEFAULT 100
            );
        `);
        console.log('Created known_locations table');
    } catch (e: any) {
        console.log('Error creating table: ', e.message);
    }

    console.log('Migration done');
    process.exit(0);
}

migrate();
