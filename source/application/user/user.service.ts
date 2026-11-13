import { Injectable } from '@nestjs/common';

import { UserRepository } from '../../database/repository/user.repository.js';

@Injectable()
export class UserService {
  constructor(private readonly user: UserRepository) {}
}
