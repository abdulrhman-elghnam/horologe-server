import { AuthProviderEnum, SystemRoleEnum } from '../value/security.enum.js';

interface Timestamps {
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends Timestamps {
  id?: string;
  role: SystemRoleEnum;
  name: string;
  email: string;
  passwordHash?: string | null;
  city: string;
  phone?: string | null;
  avatarKey?: string | null;
  avatarUrl?: string | null;
  provider?: AuthProviderEnum;
  googleId?: string | null;
  emailVerifiedAt?: Date | null;
  consentAcceptedAt?: Date | null;
  isActive?: boolean;
  language?: 'en' | 'ar' | null;
}
