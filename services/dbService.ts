import { turso } from './tursoClient';
import { User, Collaborator, AttendanceRecord, Role, Shift, Schedule, ShiftPattern, Visit, KnownLocation } from '../types';

function rowToObj<T>(columns: readonly string[], row: unknown): T {
  const r = row as unknown[];
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => { obj[col] = r[i] });
  return obj as T;
}

function rowsToArr<T>(columns: readonly string[], rows: unknown): T[] {
  const r = rows as unknown[][];
  return r.map(row => rowToObj<T>(columns, row));
}

function generateId(): string {
  return crypto.randomUUID();
}

class DbService {
  async login(email: string, password: string): Promise<{ user: User | null }> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM users WHERE email = ? AND password = ?',
      args: [email, password],
    });
    if (rs.rows.length === 0) return { user: null };
    const user = rowToObj<User>(rs.columns, rs.rows[0] );
    return { user };
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
    const rs = await turso.execute('SELECT * FROM users');
    return rowsToArr<User>(rs.columns, rs.rows);
  }

  async addUser(user: Omit<User, 'id'>): Promise<User> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO users (id, name, email, role, password) VALUES (?, ?, ?, ?, ?)',
      args: [id, user.name, user.email, user.role, ''],
    });
    return { id, ...user };
  }

  async updateUser(user: User): Promise<User> {
    await turso.execute({
      sql: 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
      args: [user.name, user.email, user.role, user.id],
    });
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
  }

  // --- Collaborators ---
  async getCollaborators(): Promise<Collaborator[]> {
    const rs = await turso.execute('SELECT * FROM collaborators');
    return rowsToArr<Collaborator>(rs.columns, rs.rows);
  }

  async addCollaborator(collaborator: Omit<Collaborator, 'id'>): Promise<Collaborator> {
    const id = generateId();
    // Try to ensure pin column exists before inserting (migration)
    try { await turso.execute('ALTER TABLE collaborators ADD COLUMN pin TEXT'); } catch(e) {}
    
    await turso.execute({
      sql: 'INSERT INTO collaborators (id, name, position, photo, role_id, pin) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, collaborator.name, collaborator.position, collaborator.photo, collaborator.role_id || null, collaborator.pin || null],
    });
    return { id, ...collaborator };
  }

  async updateCollaborator(collaborator: Collaborator): Promise<Collaborator> {
    // Try to ensure pin column exists before updating (migration)
    try { await turso.execute('ALTER TABLE collaborators ADD COLUMN pin TEXT'); } catch(e) {}

    await turso.execute({
      sql: 'UPDATE collaborators SET name = ?, position = ?, photo = ?, role_id = ?, pin = ? WHERE id = ?',
      args: [collaborator.name, collaborator.position, collaborator.photo, collaborator.role_id || null, collaborator.pin || null, collaborator.id],
    });
    return collaborator;
  }

  async deleteCollaborator(collaboratorId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM collaborators WHERE id = ?', args: [collaboratorId] });
  }

  // --- Roles ---
  async getRoles(): Promise<Role[]> {
    const rs = await turso.execute('SELECT * FROM roles');
    return rowsToArr<Role>(rs.columns, rs.rows);
  }

  async addRole(role: Omit<Role, 'id'>): Promise<Role> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO roles (id, name) VALUES (?, ?)',
      args: [id, role.name],
    });
    return { id, ...role };
  }

  async updateRole(role: Role): Promise<Role> {
    await turso.execute({
      sql: 'UPDATE roles SET name = ? WHERE id = ?',
      args: [role.name, role.id],
    });
    return role;
  }

  async deleteRole(roleId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM roles WHERE id = ?', args: [roleId] });
  }

  // --- Attendance ---
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const rs = await turso.execute('SELECT * FROM attendance_records');
    return rowsToArr<AttendanceRecord>(rs.columns, rs.rows);
  }

  async getAttendanceRecordsByDate(date: string): Promise<AttendanceRecord[]> {
    const startDate = new Date(`${date}T00:00:00`).toISOString();
    const endDate = new Date(`${date}T23:59:59.999`).toISOString();
    const rs = await turso.execute({
      sql: 'SELECT * FROM attendance_records WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      args: [startDate, endDate],
    });
    return rowsToArr<AttendanceRecord>(rs.columns, rs.rows);
  }

  async getAttendanceRecordsByCollaboratorId(collaboratorId: string): Promise<AttendanceRecord[]> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM attendance_records WHERE collaborator_id = ? ORDER BY timestamp DESC LIMIT 20',
      args: [collaboratorId],
    });
    return rowsToArr<AttendanceRecord>(rs.columns, rs.rows);
  }

  async addAttendanceRecord(record: Omit<AttendanceRecord, 'id' | 'captured_photo_url'>, photoBase64?: string | null): Promise<AttendanceRecord> {
    const id = generateId();
    const newRecord = { ...record, id, captured_photo_url: photoBase64 || undefined };
    await turso.execute({
      sql: 'INSERT INTO attendance_records (id, collaborator_id, collaborator_name, timestamp, type, captured_photo_url, latitude, longitude, location_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, record.collaborator_id, record.collaborator_name, record.timestamp, record.type, photoBase64 || null, record.latitude || null, record.longitude || null, record.location_name || null],
    });
    return newRecord as AttendanceRecord;
  }

  async updateAttendanceRecordAIStatus(recordId: string, spoofStatus: string, wellnessStatus: string, reason: string): Promise<void> {
    await turso.execute({
      sql: 'UPDATE attendance_records SET spoof_status = ?, wellness_status = ?, ai_analysis_reason = ? WHERE id = ?',
      args: [spoofStatus, wellnessStatus, reason, recordId]
    });
  }

  async getLastRecordForCollaborator(collaboratorId: string): Promise<AttendanceRecord | null> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM attendance_records WHERE collaborator_id = ? ORDER BY timestamp DESC LIMIT 1',
      args: [collaboratorId],
    });
    if (rs.rows.length === 0) return null;
    return rowToObj<AttendanceRecord>(rs.columns, rs.rows[0] );
  }

  async deleteAttendanceRecord(recordId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM attendance_records WHERE id = ?', args: [recordId] });
  }

  // --- Shifts ---
  async getShifts(): Promise<Shift[]> {
    const rs = await turso.execute('SELECT * FROM shifts');
    return rowsToArr<Shift>(rs.columns, rs.rows);
  }

  async addShift(shift: Omit<Shift, 'id'>): Promise<Shift> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO shifts (id, name, start_time, end_time, color) VALUES (?, ?, ?, ?, ?)',
      args: [id, shift.name, shift.start_time, shift.end_time, shift.color],
    });
    return { id, ...shift };
  }

  async updateShift(shift: Shift): Promise<Shift> {
    await turso.execute({
      sql: 'UPDATE shifts SET name = ?, start_time = ?, end_time = ?, color = ? WHERE id = ?',
      args: [shift.name, shift.start_time, shift.end_time, shift.color, shift.id],
    });
    return shift;
  }

  async deleteShift(shiftId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM shifts WHERE id = ?', args: [shiftId] });
  }

  // --- Schedules ---
  async getSchedules(startDate: string, endDate: string): Promise<Schedule[]> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM schedules WHERE date >= ? AND date <= ?',
      args: [startDate, endDate],
    });
    return rowsToArr<Schedule>(rs.columns, rs.rows);
  }

  async getScheduleForCollaboratorOnDate(collaboratorId: string, date: string): Promise<Schedule | null> {
    const rs = await turso.execute({
      sql: 'SELECT * FROM schedules WHERE collaborator_id = ? AND date = ?',
      args: [collaboratorId, date],
    });
    if (rs.rows.length === 0) return null;
    return rowToObj<Schedule>(rs.columns, rs.rows[0] );
  }

  async addSchedule(schedule: Omit<Schedule, 'id' | 'status'>): Promise<Schedule> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO schedules (id, collaborator_id, shift_id, date, status) VALUES (?, ?, ?, ?, ?)',
      args: [id, schedule.collaborator_id, schedule.shift_id, schedule.date, 'scheduled'],
    });
    return { id, ...schedule, status: 'scheduled' };
  }

  async updateSchedule(schedule: Schedule): Promise<Schedule> {
    await turso.execute({
      sql: 'UPDATE schedules SET collaborator_id = ?, shift_id = ?, date = ?, status = ? WHERE id = ?',
      args: [schedule.collaborator_id, schedule.shift_id, schedule.date, schedule.status, schedule.id],
    });
    return schedule;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM schedules WHERE id = ?', args: [scheduleId] });
  }

  async generateSchedules(patternId: string, startDate: string, endDate: string, collaboratorIds: string[]): Promise<void> {
    const rs = await turso.execute({
      sql: 'SELECT sequence FROM shift_patterns WHERE id = ?',
      args: [patternId],
    });
    if (rs.rows.length === 0) throw new Error('Patrón de turno no encontrado.');
    const row = rowToObj<{ sequence: string }>(rs.columns, rs.rows[0] );
    const sequence: (string | null)[] = JSON.parse(row.sequence);
    if (!sequence || sequence.length === 0) return;

    const newSchedules: Omit<Schedule, 'id'>[] = [];
    let currentDate = new Date(startDate);
    const finalDate = new Date(endDate);
    let dayCounter = 0;

    while (currentDate <= finalDate) {
      const shiftId = sequence[dayCounter % sequence.length];
      if (shiftId) {
        for (const collaboratorId of collaboratorIds) {
          newSchedules.push({
            collaborator_id: collaboratorId,
            shift_id: shiftId,
            date: currentDate.toISOString().split('T')[0],
            status: 'scheduled',
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
      dayCounter++;
    }

    if (newSchedules.length > 0) {
      await this.bulkCreateSchedules(newSchedules);
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

    const prevSchedules = await this.getSchedules(prevStartStr, prevEndStr);
    if (prevSchedules.length === 0) throw new Error('No hay horarios en la semana anterior para copiar.');

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
          status: 'scheduled',
        });
      }
    });

    if (newSchedules.length > 0) {
      await this.bulkCreateSchedules(newSchedules);
    }
  }

  async bulkCreateSchedules(schedules: Omit<Schedule, 'id'>[]): Promise<void> {
    if (schedules.length === 0) return;
    const placeholders = schedules.map(() => '(?, ?, ?, ?, ?)').join(',');
    const values: any[] = [];
    for (const s of schedules) {
      values.push(generateId(), s.collaborator_id, s.shift_id, s.date, s.status);
    }
    await turso.execute({
      sql: `INSERT INTO schedules (id, collaborator_id, shift_id, date, status) VALUES ${placeholders}`,
      args: values,
    });
  }

  // --- Shift Patterns ---
  async getShiftPatterns(): Promise<ShiftPattern[]> {
    const rs = await turso.execute('SELECT * FROM shift_patterns');
    const patterns = rowsToArr<any>(rs.columns, rs.rows);
    return patterns.map(p => ({ ...p, sequence: typeof p.sequence === 'string' ? JSON.parse(p.sequence) : p.sequence }));
  }

  async addShiftPattern(pattern: Omit<ShiftPattern, 'id'>): Promise<ShiftPattern> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO shift_patterns (id, name, sequence) VALUES (?, ?, ?)',
      args: [id, pattern.name, JSON.stringify(pattern.sequence)],
    });
    return { id, ...pattern };
  }

  async updateShiftPattern(pattern: ShiftPattern): Promise<ShiftPattern> {
    await turso.execute({
      sql: 'UPDATE shift_patterns SET name = ?, sequence = ? WHERE id = ?',
      args: [pattern.name, JSON.stringify(pattern.sequence), pattern.id],
    });
    return pattern;
  }

  async deleteShiftPattern(patternId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM shift_patterns WHERE id = ?', args: [patternId] });
  }

  // --- Visits ---
  async registerVisit(visit: Omit<Visit, 'id' | 'timestamp' | 'signature_url'>, signatureBase64: string): Promise<Visit> {
    try {
      const id = generateId();
      const newVisit = {
        ...visit,
        id,
        signature_url: signatureBase64,
        timestamp: new Date().toISOString(),
      };
      await turso.execute({
        sql: 'INSERT INTO visits (id, full_name, gov_id, company, signature_url, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, visit.full_name, visit.gov_id, visit.company, signatureBase64, newVisit.timestamp],
      });
      return newVisit;
    } catch (error) {
      console.warn('Error guardando visita en Turso, guardando en localStorage.', error);
      const mockVisit: Visit = {
        ...visit,
        id: `fake-${Date.now()}`,
        timestamp: new Date().toISOString(),
        signature_url: signatureBase64,
      };
      saveMockVisit(mockVisit);
      return mockVisit;
    }
  }

  async searchVisitors(query: string): Promise<Visit[]> {
    if (!query) return [];
    try {
      const rs = await turso.execute({
        sql: "SELECT * FROM visits WHERE LOWER(full_name) LIKE ? OR LOWER(gov_id) LIKE ? ORDER BY timestamp DESC LIMIT 20",
        args: [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`],
      });
      const results = rowsToArr<Visit>(rs.columns, rs.rows);
      const unique = new Map<string, Visit>();
      results.forEach(v => { if (!unique.has(v.gov_id)) unique.set(v.gov_id, v); });
      return Array.from(unique.values());
    } catch (error) {
      console.warn('Error buscando visitantes en DB, usando localStorage', error);
      const lowerQuery = query.toLowerCase();
      const mockVisits = getMockVisits();
      const results = mockVisits.filter(v =>
        v.full_name.toLowerCase().includes(lowerQuery) ||
        v.gov_id.toLowerCase().includes(lowerQuery)
      );
      const unique = new Map<string, Visit>();
      results.forEach(v => { if (!unique.has(v.gov_id)) unique.set(v.gov_id, v); });
      return Array.from(unique.values());
    }
  }

  async getVisitsByDate(date: string): Promise<Visit[]> {
    const startDate = new Date(`${date}T00:00:00`).toISOString();
    const endDate = new Date(`${date}T23:59:59.999`).toISOString();
    try {
      const rs = await turso.execute({
        sql: 'SELECT * FROM visits WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
        args: [startDate, endDate],
      });
      return rowsToArr<Visit>(rs.columns, rs.rows);
    } catch (error) {
      console.warn('Error obteniendo visitas de DB, usando localStorage', error);
      const start = new Date(`${date}T00:00:00`).getTime();
      const end = new Date(`${date}T23:59:59.999`).getTime();
      const mockVisits = getMockVisits();
      return mockVisits
        .filter(v => { const t = new Date(v.timestamp).getTime(); return t >= start && t <= end; })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }

  async getVisitHistory(startDate: string, endDate: string, searchTerm: string = ''): Promise<Visit[]> {
    const start = new Date(`${startDate}T00:00:00`).toISOString();
    const end = new Date(`${endDate}T23:59:59.999`).toISOString();
    try {
      if (searchTerm) {
        const rs = await turso.execute({
          sql: "SELECT * FROM visits WHERE timestamp >= ? AND timestamp <= ? AND (LOWER(full_name) LIKE ? OR LOWER(gov_id) LIKE ? OR LOWER(company) LIKE ?) ORDER BY timestamp DESC",
          args: [start, end, `%${searchTerm.toLowerCase()}%`, `%${searchTerm.toLowerCase()}%`, `%${searchTerm.toLowerCase()}%`],
        });
        return rowsToArr<Visit>(rs.columns, rs.rows);
      } else {
        const rs = await turso.execute({
          sql: 'SELECT * FROM visits WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
          args: [start, end],
        });
        return rowsToArr<Visit>(rs.columns, rs.rows);
      }
    } catch (error) {
      console.warn('Error obteniendo historial de visitas de DB, usando localStorage', error);
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      const searchLower = searchTerm.toLowerCase();
      const mockVisits = getMockVisits();
      return mockVisits
        .filter(v => {
          const t = new Date(v.timestamp).getTime();
          const matchesTime = t >= startMs && t <= endMs;
          const matchesSearch = !searchTerm ||
            v.full_name.toLowerCase().includes(searchLower) ||
            v.gov_id.toLowerCase().includes(searchLower) ||
            v.company.toLowerCase().includes(searchLower);
          return matchesTime && matchesSearch;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  }

  // --- Known Locations (Geocercas) ---
  async getKnownLocations(): Promise<KnownLocation[]> {
    const rs = await turso.execute('SELECT * FROM known_locations');
    return rowsToArr<KnownLocation>(rs.columns, rs.rows);
  }

  async addKnownLocation(location: Omit<KnownLocation, 'id'>): Promise<KnownLocation> {
    const id = generateId();
    await turso.execute({
      sql: 'INSERT INTO known_locations (id, name, lat, lon, radius) VALUES (?, ?, ?, ?, ?)',
      args: [id, location.name, location.lat, location.lon, location.radius],
    });
    return { id, ...location };
  }

  async updateKnownLocation(location: KnownLocation): Promise<KnownLocation> {
    await turso.execute({
      sql: 'UPDATE known_locations SET name = ?, lat = ?, lon = ?, radius = ? WHERE id = ?',
      args: [location.name, location.lat, location.lon, location.radius, location.id],
    });
    return location;
  }

  async deleteKnownLocation(locationId: string): Promise<void> {
    await turso.execute({ sql: 'DELETE FROM known_locations WHERE id = ?', args: [locationId] });
  }

  // --- Settings ---
  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    await turso.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const rs = await turso.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: [key]
    });
    if (rs.rows.length === 0) return defaultValue;
    return rs.rows[0].value as string;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await turso.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await turso.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      args: [key, value, value]
    });
  }
}

// Mock visits localStorage helpers
const MOCK_VISITS_KEY = 'nominAI_mock_visits';
const getMockVisits = (): Visit[] => {
  try {
    const stored = localStorage.getItem(MOCK_VISITS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};
const saveMockVisit = (visit: Visit) => {
  try {
    const visits = getMockVisits();
    visits.push(visit);
    localStorage.setItem(MOCK_VISITS_KEY, JSON.stringify(visits));
  } catch { /* ignore */  }
}

export const dbService = new DbService();