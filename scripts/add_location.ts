import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL || 'libsql://nominai-pauloperez.aws-us-east-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ4NjExNDcsImlkIjoiMDE5ZjkyMDItZWEwMS03OGI0LWFlMjctMmY5NTExNjExYmYxIiwia2lkIjoiZjlnY09MVnU5dDJqQ0ozM0x1dFdkTTFIeFhlR3dJUVFIZ19KZ2dSZkwyayIsInJpZCI6IjVjNmZmMDM5LThjNDMtNGE4MS1iYzdkLWY2MGEwNjVkODk3OSJ9.iTvd4Ck5RhNIXsPvvVcf6tido9akI2bID494IkI0gv7fODlKR5uHqtE1BxoWdUpOXwmHF7DVF-A2pfPPWMa_Bg';

async function migrate() {
    const turso = createClient({
        url: TURSO_URL,
        authToken: TURSO_TOKEN,
    });

    try {
        await turso.execute('ALTER TABLE attendance_records ADD COLUMN latitude REAL;');
        console.log('Added latitude');
    } catch (e: any) {
        console.log('Latitude might already exist: ', e.message);
    }
    
    try {
        await turso.execute('ALTER TABLE attendance_records ADD COLUMN longitude REAL;');
        console.log('Added longitude');
    } catch (e: any) {
        console.log('Longitude might already exist: ', e.message);
    }

    console.log('Migration done');
    process.exit(0);
}

migrate();
