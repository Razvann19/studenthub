export interface User {
  id: number;
  email: string;
  fullName: string;
  faculty: string | null;
  year: number | null;
  section: string | null;
  studyType: 'licenta' | 'master' | null;
  isAdmin: boolean;
  createdAt?: string;
  profilePhotoUrl?: string;

}

export interface SyncResponse {
  user: User;
  isFirstLogin: boolean;
}
