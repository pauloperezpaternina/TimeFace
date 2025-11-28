
import { createClient } from '@supabase/supabase-js';

// --- Configuración de Supabase ---
// Intentamos leer de las variables de entorno.
// Se mantienen los valores hardcoded como respaldo para asegurar funcionamiento en entornos de demo sin configuración.
const supabaseUrl = process.env.SUPABASE_URL || 'https://movkqjjilrlnzrhuxzzt.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdmtxamppbHJsbnpyaHV4enp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY1ODIsImV4cCI6MjA3NzMyMjU4Mn0.EtbiW6-72kcabKRg7rtUI8NBNjIWuwoECxxlVD8ibb0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Se requieren la URL y la clave anónima de Supabase. Configure las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
