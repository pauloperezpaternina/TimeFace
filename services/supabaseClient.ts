import { createClient } from '@supabase/supabase-js';

// --- Configuración de Supabase ---
const supabaseUrl = 'https://movkqjjilrlnzrhuxzzt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdmtxamppbHJsbnpyaHV4enp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDY1ODIsImV4cCI6MjA3NzMyMjU4Mn0.EtbiW6-72kcabKRg7rtUI8NBNjIWuwoECxxlVD8ibb0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Se requieren la URL y la clave anónima de Supabase.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
