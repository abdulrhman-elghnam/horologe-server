import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { User } from '../model/user.model.js';

import { SystemRoleEnum } from '../../dependency/value/security.enum.js';
import { DatabaseRepository } from './base.repository.js';
import { IUser } from '../../dependency/interface/database.interface.js';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class UserRepository extends DatabaseRepository<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super(userRepository);
  }

  get rawRepository(): Repository<User> {
    return this.userRepository;
  }

  createAuthUser(data: Partial<IUser>): Promise<User> {
    return this.userRepository.save(this.userRepository.create(data));
  }
  
  findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.googleId'])
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findByEmailWithoutPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.googleId')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findByRole(role: SystemRoleEnum): Promise<User[]> {
    return this.userRepository.findBy({ role });
  }

  updateUserProfile(userId: string, profile: Partial<Pick<IUser, 'name' | 'city' | 'phone' | 'avatarUrl' | 'avatarKey' | 'language'>>): Promise<User | null> {
    return this.findByIdAndUpdate({ id: userId, data: profile });
  }

  searchByName(name: string, limit = 10): Promise<User[]> {
    return this.userRepository.find({
      where: { name: ILike(`%${escapeLike(name)}%`) },
      take: limit,
    });
  }

  emailExists(email: string): Promise<boolean> {
    return this.userRepository.existsBy({ email: normalizeEmail(email) });
  }
}
