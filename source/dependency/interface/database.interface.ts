import { Types } from "mongoose";
import { AuthProviderEnum, SystemRoleEnum } from "../enum/security.enum.js";

interface Timestamps {
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends Timestamps {
  _id?: Types.ObjectId;
  role: SystemRoleEnum;
  name: string;
  email: string;
  passwordHash?: string;
  city: string;
  phone?: string;
  avatarKey?: string;
  avatarUrl?: string;
  provider?: AuthProviderEnum;
  googleId?: string;
  emailVerifiedAt?: Date | null;
  consentAcceptedAt?: Date | null;
  isActive?: boolean;
  language?: string | null;
}