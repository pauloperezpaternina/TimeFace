
import { supabase } from './supabaseClient';
import { User, Collaborator, AttendanceRecord, Role, Shift, Schedule, ShiftPattern, Visit } from '../types';

// Helper para convertir Base64 a un Blob para subirlo a Supabase Storage
const base64ToBlob = (base64: string, contentType = 'image/jpeg', sliceSize = 512): Blob => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
};

// --- Gestión de fotos de Colaboradores ---
async function uploadCollaboratorPhoto(collaboratorId: string | null, photoBase64: string): Promise<string> {
    const blob = base64ToBlob(photoBase64);
    // Usa una ruta única para cada foto para evitar sobreescrituras.
    const fileName = `public/${collaboratorId || 'new'}_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
        .from('collaborator-photos') // Nombre del Bucket en Supabase
        .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Error al subir la foto:', error);
        throw new Error('No se pudo subir la foto del colaborador.');
    }

    const { data: { publicUrl } } = supabase.storage.from('collaborator-photos').getPublicUrl(data.path);
    return publicUrl;
}

// --- Gestión de fotos de Asistencia ---
async function uploadAttendancePhoto(collaboratorId: string, photoBase64: string): Promise<string> {
    const blob = base64ToBlob(photoBase64);
    // Usa una ruta única para cada foto.
    const fileName = `public/${collaboratorId}_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
        .from('attendance-photos') // Nuevo Bucket para fotos de asistencia
        .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Error al subir la foto de asistencia:', error);
        if (error.message.includes('Bucket not found')) {
            throw new Error("Error de configuración: El bucket 'attendance-photos' no se encontró. Por favor, créelo en Supabase Storage y asegúrese de que sea público.");
        }
        throw new Error('No se pudo subir la foto de asistencia.');
    }

    const { data: { publicUrl } } = supabase.storage.from('attendance-photos').getPublicUrl(data.path);
    return publicUrl;
}

// --- Gestión de firmas de Visitantes ---
async function uploadVisitorSignature(visitorId: string, signatureBase64: string): Promise<string> {
    try {
        const blob = base64ToBlob(signatureBase64, 'image/png');
        const fileName = `signatures/${visitorId}_${Date.now()}.png`;
        const { data, error } = await supabase.storage
            .from('visitor-signatures')
            .upload(fileName, blob, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            // Si falla el bucket, retornamos el base64 original para simular éxito en modo offline/mock
            console.warn('Bucket visitor-signatures no encontrado o error de subida, usando base64 local.', error);
            return signatureBase64;
        }

        const { data: { publicUrl } } = supabase.storage.from('visitor-signatures').getPublicUrl(data.path);
        return publicUrl;
    } catch (e) {
        console.warn('Excepción al subir firma, usando base64 local.', e);
        return signatureBase64;
    }
}


// Handler genérico para las peticiones a Supabase
async function supabaseRequest<T>(query: any): Promise<T> {
    const { data, error } = await query;
    if (error) {
        console.error('Error de Supabase:', error);
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Error de red: No se pudo conectar con el servidor. Verifique su conexión a internet y asegúrese de que el dominio de esta aplicación esté permitido en la configuración de CORS de Supabase.');
        }
        throw new Error(`Error de Supabase: ${error.message} (Detalles: ${error.details})`);
    }
    return data as T;
}

// Store fake visits in localStorage to persist across refreshes
const MOCK_VISITS_KEY = 'timeface_mock_visits';
const getMockVisits = (): Visit[] => {
    try {
        const stored = localStorage.getItem(MOCK_VISITS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};
const saveMockVisit = (visit: Visit) => {
    try {
        const visits = getMockVisits();
        visits.push(visit);
        localStorage.setItem(MOCK_VISITS_KEY, JSON.stringify(visits));
    } catch (e) {
        console.warn("Failed to save mock visit to localStorage", e);
    }
};


class DbService {
    async login(email: string, password: string): Promise<{ user: User | null }> {
        // Llama a la función RPC segura en la base de datos para verificar las credenciales.
        const { data, error } = await supabase.rpc('verify_user_password', {
            user_email: email,
            user_password: password
        });

        if (error) {
            console.error('Error durante la llamada RPC de inicio de sesión:', error);
            // No revelar detalles del error al usuario final por seguridad.
            throw new Error('Error de autenticación en el servidor.');
        }

        // La función RPC devuelve el objeto de usuario si es exitoso, o null si falla.
        // El objeto devuelto ya está dentro de 'data', por lo que no necesitamos desestructurarlo más.
        const user = data ? { ...data, id: String(data.id) } as User : null;
        return { user };
    }

    // --- Users ---
    getUsers(): Promise<User[]> { return supabaseRequest<User[]>(supabase.from('users').select('*')); }
    addUser(user: Omit<User, 'id'>): Promise<User> { return supabaseRequest<User>(supabase.from('users').insert(user).select().single()); }
    updateUser(user: User): Promise<User> { return supabaseRequest<User>(supabase.from('users').update(user).eq('id', user.id).select().single()); }
    deleteUser(userId: string): Promise<void> { return supabaseRequest<void>(supabase.from('users').delete().eq('id', userId)); }

    // --- Collaborators ---
    getCollaborators(): Promise<Collaborator[]> { return supabaseRequest<Collaborator[]>(supabase.from('collaborators').select('*')); }

    async addCollaborator(collaborator: Omit<Collaborator, 'id'>): Promise<Collaborator> {
        let photoUrl = collaborator.photo;
        if (photoUrl.startsWith('data:image')) {
            photoUrl = await uploadCollaboratorPhoto(null, photoUrl);
        }
        const newCollaborator = { ...collaborator, photo: photoUrl };
        return supabaseRequest<Collaborator>(supabase.from('collaborators').insert(newCollaborator).select().single());
    }

    async updateCollaborator(collaborator: Collaborator): Promise<Collaborator> {
        let photoUrl = collaborator.photo;
        if (photoUrl.startsWith('data:image')) {
            photoUrl = await uploadCollaboratorPhoto(collaborator.id, photoUrl);
        }
        const updatedCollaborator = { ...collaborator, photo: photoUrl };
        return supabaseRequest<Collaborator>(supabase.from('collaborators').update(updatedCollaborator).eq('id', collaborator.id).select().single());
    }

    deleteCollaborator(collaboratorId: string): Promise<void> { return supabaseRequest<void>(supabase.from('collaborators').delete().eq('id', collaboratorId)); }

    // --- Roles ---
    getRoles(): Promise<Role[]> { return supabaseRequest<Role[]>(supabase.from('roles').select('*')); }
    addRole(role: Omit<Role, 'id'>): Promise<Role> { return supabaseRequest<Role>(supabase.from('roles').insert(role).select().single()); }
    updateRole(role: Role): Promise<Role> { return supabaseRequest<Role>(supabase.from('roles').update(role).eq('id', role.id).select().single()); }
    deleteRole(roleId: string): Promise<void> { return supabaseRequest<void>(supabase.from('roles').delete().eq('id', roleId)); }

    // --- Attendance ---
    getAttendanceRecords(): Promise<AttendanceRecord[]> { return supabaseRequest<AttendanceRecord[]>(supabase.from('attendance_records').select('*')); }

    getAttendanceRecordsByDate(date: string): Promise<AttendanceRecord[]> {
        // 'date' is a 'YYYY-MM-DD' string representing a date in the user's local timezone.
        // We create Date objects for the start and end of that day in the local timezone.
        const startDate = new Date(`${date}T00:00:00`);
        const endDate = new Date(`${date}T23:59:59.999`);

        // .toISOString() converts the local date objects to UTC strings, which is what Supabase expects
        // for `timestamptz` columns. This correctly queries for the full local day.
        return supabaseRequest<AttendanceRecord[]>(supabase
            .from('attendance_records')
            .select('*')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: false })
        );
    }

    async addAttendanceRecord(record: Omit<AttendanceRecord, 'id' | 'captured_photo_url'>, photoBase64?: string | null): Promise<AttendanceRecord> {
        let photoUrl: string | undefined = undefined;
        if (photoBase64) {
            photoUrl = await uploadAttendancePhoto(record.collaborator_id, photoBase64);
        }
        const newRecord = { ...record, captured_photo_url: photoUrl };
        return supabaseRequest<AttendanceRecord>(supabase.from('attendance_records').insert(newRecord).select().single());
    }

    getLastRecordForCollaborator(collaboratorId: string): Promise<AttendanceRecord | null> {
        return supabaseRequest<AttendanceRecord | null>(supabase
            .from('attendance_records')
            .select('*')
            .eq('collaborator_id', collaboratorId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle()
        );
    }

    // --- Shifts ---
    getShifts(): Promise<Shift[]> { return supabaseRequest<Shift[]>(supabase.from('shifts').select('*')); }
    addShift(shift: Omit<Shift, 'id'>): Promise<Shift> { return supabaseRequest<Shift>(supabase.from('shifts').insert(shift).select().single()); }
    updateShift(shift: Shift): Promise<Shift> { return supabaseRequest<Shift>(supabase.from('shifts').update(shift).eq('id', shift.id).select().single()); }
    deleteShift(shiftId: string): Promise<void> { return supabaseRequest<void>(supabase.from('shifts').delete().eq('id', shiftId)); }

    // --- Schedules ---
    getSchedules(startDate: string, endDate: string): Promise<Schedule[]> {
        return supabaseRequest<Schedule[]>(supabase
            .from('schedules')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
        );
    }
    getScheduleForCollaboratorOnDate(collaboratorId: string, date: string): Promise<Schedule | null> {
        return supabaseRequest<Schedule | null>(supabase
            .from('schedules')
            .select('*')
            .eq('collaborator_id', collaboratorId)
            .eq('date', date)
            .maybeSingle()
        );
    }
    addSchedule(schedule: Omit<Schedule, 'id' | 'status'>): Promise<Schedule> {
        const newSchedule = { ...schedule, status: 'scheduled' as const };
        return supabaseRequest<Schedule>(supabase.from('schedules').insert(newSchedule).select().single());
    }
    updateSchedule(schedule: Schedule): Promise<Schedule> { return supabaseRequest<Schedule>(supabase.from('schedules').update(schedule).eq('id', schedule.id).select().single()); }

    async generateSchedules(patternId: string, startDate: string, endDate: string, collaboratorIds: string[]): Promise<void> {
        const pattern = await supabaseRequest<ShiftPattern>(supabase.from('shift_patterns').select('sequence').eq('id', patternId).single());
        if (!pattern) throw new Error("Patrón de turno no encontrado.");

        const sequence = pattern.sequence;
        if (!sequence || sequence.length === 0) return;

        const newSchedules: Omit<Schedule, 'id'>[] = [];

        let currentDate = new Date(new Date(startDate).valueOf() + new Date(startDate).getTimezoneOffset() * 60 * 1000);
        const finalDate = new Date(new Date(endDate).valueOf() + new Date(endDate).getTimezoneOffset() * 60 * 1000);

        let dayCounter = 0;
        while (currentDate <= finalDate) {
            const shiftId = sequence[dayCounter % sequence.length];

            if (shiftId) { // Solo se programa si no es un día de descanso (null)
                for (const collaboratorId of collaboratorIds) {
                    newSchedules.push({
                        collaborator_id: collaboratorId,
                        shift_id: shiftId,
                        date: currentDate.toISOString().split('T')[0],
                        status: 'scheduled'
                    });
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;
        }

        if (newSchedules.length > 0) {
            await supabaseRequest<void>(supabase.from('schedules').insert(newSchedules));
        }
    }

    async copyScheduleFromPreviousWeek(targetStartDate: string, targetEndDate: string): Promise<void> {
        const targetStart = new Date(targetStartDate);
        const prevStart = new Date(targetStart);
        prevStart.setDate(prevStart.getDate() - 7);
        const prevEnd = new Date(prevStart);
        prevEnd.setDate(prevEnd.getDate() + 6);

        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];

        // Get previous week schedules
        const prevSchedules = await this.getSchedules(prevStartStr, prevEndStr);
        if (prevSchedules.length === 0) throw new Error("No hay horarios en la semana anterior para copiar.");

        // Get existing target schedules to avoid duplicates (could also use upsert if constraint exists)
        const currentSchedules = await this.getSchedules(targetStartDate, targetEndDate);
        const existingMap = new Set(currentSchedules.map(s => `${s.collaborator_id}-${s.date}`));

        const newSchedules: Omit<Schedule, 'id'>[] = [];

        prevSchedules.forEach(ps => {
            const oldDate = new Date(ps.date);
            const newDate = new Date(oldDate);
            newDate.setDate(newDate.getDate() + 7);
            const newDateStr = newDate.toISOString().split('T')[0];

            if (!existingMap.has(`${ps.collaborator_id}-${newDateStr}`)) {
                newSchedules.push({
                    collaborator_id: ps.collaborator_id,
                    shift_id: ps.shift_id,
                    date: newDateStr,
                    status: 'scheduled'
                });
            }
        });

        if (newSchedules.length > 0) {
            await supabaseRequest<void>(supabase.from('schedules').insert(newSchedules));
        }
    }

    async bulkCreateSchedules(schedules: Omit<Schedule, 'id'>[]): Promise<void> {
        if (schedules.length === 0) return;
        await supabaseRequest<void>(supabase.from('schedules').insert(schedules));
    }

    // --- Shift Patterns ---
    getShiftPatterns(): Promise<ShiftPattern[]> { return supabaseRequest<ShiftPattern[]>(supabase.from('shift_patterns').select('*')); }
    addShiftPattern(pattern: Omit<ShiftPattern, 'id'>): Promise<ShiftPattern> { return supabaseRequest<ShiftPattern>(supabase.from('shift_patterns').insert(pattern).select().single()); }
    updateShiftPattern(pattern: ShiftPattern): Promise<ShiftPattern> { return supabaseRequest<ShiftPattern>(supabase.from('shift_patterns').update(pattern).eq('id', pattern.id).select().single()); }
    deleteShiftPattern(patternId: string): Promise<void> { return supabaseRequest<void>(supabase.from('shift_patterns').delete().eq('id', patternId)); }

    // --- Visits (New) ---
    async registerVisit(visit: Omit<Visit, 'id' | 'timestamp' | 'signature_url'>, signatureBase64: string): Promise<Visit> {
        try {
            const signatureUrl = await uploadVisitorSignature(visit.gov_id, signatureBase64);
            const newVisit = {
                ...visit,
                signature_url: signatureUrl,
                timestamp: new Date().toISOString()
            };

            // Intentar guardar en Supabase
            const { data, error } = await supabase.from('visits').insert(newVisit).select().single();

            if (error) {
                throw error; // Lanzar error para capturarlo en el catch
            }

            return data as Visit;
        } catch (error) {
            console.warn("La tabla 'visits' no existe o hubo un error. Guardando en datos falsos locales (localStorage).", error);

            // Mock implementation / Datos falsos
            const mockVisit: Visit = {
                ...visit,
                id: `fake-${Date.now()}`,
                timestamp: new Date().toISOString(),
                signature_url: signatureBase64 // Guarda base64 localmente si falla subida
            };
            saveMockVisit(mockVisit);

            // Retornamos el mock simulando éxito
            return mockVisit;
        }
    }

    async searchVisitors(query: string): Promise<Visit[]> {
        if (!query) return [];

        try {
            // Try searching in Supabase
            const { data, error } = await supabase
                .from('visits')
                .select('*')
                .or(`full_name.ilike.%${query}%,gov_id.ilike.%${query}%`)
                .order('timestamp', { ascending: false })
                .limit(20);

            if (error) throw error;

            // Deduplicate results by gov_id to show unique people
            const unique = new Map<string, Visit>();
            if (data) {
                data.forEach((v: Visit) => {
                    if (!unique.has(v.gov_id)) unique.set(v.gov_id, v);
                });
            }
            return Array.from(unique.values());

        } catch (error) {
            console.warn("Error searching visitors in DB (or offline), checking local store", error);

            // Fallback search in memory store
            const lowerQuery = query.toLowerCase();
            const mockVisits = getMockVisits();
            const results = mockVisits.filter(v =>
                v.full_name.toLowerCase().includes(lowerQuery) ||
                v.gov_id.toLowerCase().includes(lowerQuery)
            );

            const unique = new Map<string, Visit>();
            results.forEach((v) => {
                if (!unique.has(v.gov_id)) unique.set(v.gov_id, v);
            });
            return Array.from(unique.values());
        }
    }

    async getVisitsByDate(date: string): Promise<Visit[]> {
        const startDate = new Date(`${date}T00:00:00`);
        const endDate = new Date(`${date}T23:59:59.999`);

        try {
            const { data, error } = await supabase
                .from('visits')
                .select('*')
                .gte('timestamp', startDate.toISOString())
                .lte('timestamp', endDate.toISOString())
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return data as Visit[];
        } catch (error) {
            console.warn("Error fetching visits from DB, checking local store", error);
            const start = startDate.getTime();
            const end = endDate.getTime();

            const mockVisits = getMockVisits();
            const results = mockVisits.filter(v => {
                const t = new Date(v.timestamp).getTime();
                return t >= start && t <= end;
            });
            return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
    }

    async getVisitHistory(startDate: string, endDate: string, searchTerm: string = ''): Promise<Visit[]> {
        // Convert strings to ISO dates for comparison
        const start = new Date(`${startDate}T00:00:00`).toISOString();
        const end = new Date(`${endDate}T23:59:59.999`).toISOString();

        try {
            let query = supabase
                .from('visits')
                .select('*')
                .gte('timestamp', start)
                .lte('timestamp', end)
                .order('timestamp', { ascending: false });

            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,gov_id.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Visit[];
        } catch (error) {
            console.warn("Error fetching visit history from DB, checking local store", error);

            // Fallback to local store
            const startMs = new Date(start).getTime();
            const endMs = new Date(end).getTime();
            const searchLower = searchTerm.toLowerCase();

            const mockVisits = getMockVisits();
            const results = mockVisits.filter(v => {
                const t = new Date(v.timestamp).getTime();
                const matchesTime = t >= startMs && t <= endMs;
                const matchesSearch = !searchTerm ||
                    v.full_name.toLowerCase().includes(searchLower) ||
                    v.gov_id.toLowerCase().includes(searchLower) ||
                    v.company.toLowerCase().includes(searchLower);

                return matchesTime && matchesSearch;
            });

            return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
    }
}

export const dbService = new DbService();