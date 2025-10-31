
export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Collaborator {
  id: string;
  name: string;
  position: string;
  photo: string; // base64 encoded image
}

export type AttendanceType = 'entry' | 'exit';

export interface AttendanceRecord {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  timestamp: number;
  type: AttendanceType;
}
