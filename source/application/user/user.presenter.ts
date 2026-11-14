import type { User } from '../../database/model/user.model.js';
import { SignedUrl } from '../../dependency/presenter.js';

export type UserView = Omit<User, 'passwordHash' | 'googleId' | 'avatarKey' | 'version'> & { avatar: string | null };

/** Public shape of a user: no secrets, avatar as a short-lived signed URL. */
export const presentUser = (user: User): UserView => {
  const { passwordHash: _password, googleId: _google, avatarKey, version: _version, ...rest } = user;
  return { ...rest, avatar: avatarKey ? SignedUrl.sign('avatar', user.id) : (user.avatarUrl ?? null) };
};
