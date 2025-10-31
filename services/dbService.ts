
import { User, Collaborator, AttendanceRecord, Role } from '../types';

const USERS_KEY = 'logiservices_users';
const COLLABORATORS_KEY = 'logiservices_collaborators';
const ATTENDANCE_KEY = 'logiservices_attendance';

// --- MOCK INITIAL DATA ---
const getInitialUsers = (): User[] => [
  { id: 'user-1', name: 'Admin User', email: 'admin@logiservices.com', role: 'admin' },
  { id: 'user-2', name: 'Staff User', email: 'staff@logiservices.com', role: 'staff' },
];

const getInitialCollaborators = (): Collaborator[] => [
    // Add sample collaborators, but photo should be added via UI.
];


// --- GENERIC HELPERS ---
const getFromStorage = <T,>(key: string, initialData: T[]): T[] => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialData;
  } catch (error) {
    console.error(`Error reading from localStorage key “${key}”:`, error);
    return initialData;
  }
};

const saveToStorage = <T,>(key: string, data: T[]): void => {
  try {
    const item = JSON.stringify(data);
    window.localStorage.setItem(key, item);
  } catch (error) {
    console.error(`Error writing to localStorage key “${key}”:`, error);
  }
};

// --- API ---
class DbService {
  // Users
  getUsers(): User[] {
    return getFromStorage<User>(USERS_KEY, getInitialUsers());
  }

  saveUsers(users: User[]): void {
    saveToStorage<User>(USERS_KEY, users);
  }

  // Collaborators
  getCollaborators(): Collaborator[] {
    return getFromStorage<Collaborator>(COLLABORATORS_KEY, getInitialCollaborators());
  }
  
  saveCollaborators(collaborators: Collaborator[]): void {
    saveToStorage<Collaborator>(COLLABORATORS_KEY, collaborators);
  }

  // Attendance
  getAttendanceRecords(): AttendanceRecord[] {
    const records = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY, []);
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  saveAttendanceRecords(records: AttendanceRecord[]): void {
    saveToStorage<AttendanceRecord>(ATTENDANCE_KEY, records);
  }
  
  addAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): void {
      const records = this.getAttendanceRecords();
      const newRecord: AttendanceRecord = { ...record, id: `att-${Date.now()}`};
      this.saveAttendanceRecords([newRecord, ...records]);
  }

  getLastRecordForCollaborator(collaboratorId: string): AttendanceRecord | undefined {
      const records = this.getAttendanceRecords();
      return records.find(r => r.collaboratorId === collaboratorId);
  }
}

export const dbService = new DbService();
