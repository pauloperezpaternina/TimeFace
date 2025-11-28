
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Collaborator {
  id:string;
  name: string;
  position: string;
  photo: string;
  role_id?: string; // Link to a role for scheduling
}

export type AttendanceType = 'entry' | 'exit';

export interface AttendanceRecord {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  timestamp: string; // Changed from number to string to store ISO date format
  type: AttendanceType;
  captured_photo_url?: string;
}

export interface Role {
  id: string;
  name: string;
}

// New interfaces for shift management
export interface Shift {
  id: string;
  name: string;
  startTime: string; // e.g., "06:00"
  endTime: string;   // e.g., "14:00"
  color: string;     // e.g., "#34D399" for UI color coding
}

export interface Schedule {
  id: string;
  collaborator_id: string;
  shift_id: string;
  date: string; // YYYY-MM-DD
  status: 'scheduled' | 'present' | 'absent' | 'late' | 'on_leave';
}

export interface ShiftPattern {
    id: string;
    name: string;
    sequence: (string | null)[]; // Array of shift IDs or null for rest days
}

export interface Visit {
  id: string;
  full_name: string;
  gov_id: string; // Cédula
  company: string;
  signature_url: string;
  timestamp: string;
}
