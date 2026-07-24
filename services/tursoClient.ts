import { createClient } from '@libsql/client/web'

const tursoUrl = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://nominai-pauloperez.aws-us-east-1.turso.io'
const tursoToken = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ4NjExNDcsImlkIjoiMDE5ZjkyMDItZWEwMS03OGI0LWFlMjctMmY5NTExNjExYmYxIiwia2lkIjoiZjlnY09MVnU5dDJqQ0ozM0x1dFdkTTFIeFhlR3dJUVFIZ19KZ2dSZkwyayIsInJpZCI6IjVjNmZmMDM5LThjNDMtNGE4MS1iYzdkLWY2MGEwNjVkODk3OSJ9.iTvd4Ck5RhNIXsPvvVcf6tido9akI2bID494IkI0gv7fODlKR5uHqtE1BxoWdUpOXwmHF7DVF-A2pfPPWMa_Bg'

if (!tursoToken) {
  throw new Error('VITE_TURSO_AUTH_TOKEN es requerido')
}

export const turso = createClient({
  url: tursoUrl,
  authToken: tursoToken,
})