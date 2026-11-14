import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminUserQueryDto } from './dto/user.dto.js';
import { UserService } from './user.service.js';
import { AdminOnly, Audit } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';

@AdminOnly()
@ApiTags('Admin · Customers')
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly users: UserService) {}

  @Get()
  list(@Query() query: AdminUserQueryDto) {
    return this.users.listUsers(query);
  }

  @Get(':userId')
  get(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.users.getUser(userId);
  }

  @Audit('user.status.update', 'user', 'userId')
  @Patch(':userId/status')
  setStatus(@Param('userId', ParseUUIDPipe) userId: string, @Body() { isActive }: StatusDto) {
    return this.users.setCustomerStatus(userId, isActive);
  }
}
