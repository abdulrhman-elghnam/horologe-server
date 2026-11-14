import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/user.dto.js';
import { UserService } from './user.service.js';
import type { User } from '../../database/model/user.model.js';
import { Auth, CurrentUser, RateLimit } from '../../dependency/decorator/_INDEX.js';
import { UploadImagePipe } from '../../dependency/pipe/upload.pipe.js';

@Auth()
@ApiTags('Profile')
@Controller('users/me')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  profile(@CurrentUser() user: User) {
    return this.users.getProfile(user);
  }

  @Patch()
  updateProfile(@CurrentUser('id') userId: string, @Body() body: UpdateProfileDto) {
    return this.users.updateProfile(userId, body);
  }

  /** multipart/form-data with an `avatar` file (JPEG/PNG). */
  @RateLimit.upload()
  @Patch('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['avatar'], properties: { avatar: { type: 'string', format: 'binary', description: 'JPEG or PNG, max 5 MB' } } },
  })
  updateAvatar(@CurrentUser() user: User, @UploadedFile(new UploadImagePipe({ maxSize: 5 * 1024 * 1024 })) file: Express.Multer.File) {
    return this.users.updateAvatar(user, file);
  }

  @Get('addresses')
  addresses(@CurrentUser('id') userId: string) {
    return this.users.listAddresses(userId);
  }

  @Post('addresses')
  createAddress(@CurrentUser('id') userId: string, @Body() body: CreateAddressDto) {
    return this.users.createAddress(userId, body);
  }

  @Get('addresses/:addressId')
  address(@CurrentUser('id') userId: string, @Param('addressId', ParseUUIDPipe) addressId: string) {
    return this.users.getAddress(userId, addressId);
  }

  @Patch('addresses/:addressId')
  updateAddress(@CurrentUser('id') userId: string, @Param('addressId', ParseUUIDPipe) addressId: string, @Body() body: UpdateAddressDto) {
    return this.users.updateAddress(userId, addressId, body);
  }

  @Delete('addresses/:addressId')
  @HttpCode(HttpStatus.OK)
  deleteAddress(@CurrentUser('id') userId: string, @Param('addressId', ParseUUIDPipe) addressId: string) {
    return this.users.deleteAddress(userId, addressId);
  }

  @Patch('addresses/:addressId/default')
  setDefault(@CurrentUser('id') userId: string, @Param('addressId', ParseUUIDPipe) addressId: string) {
    return this.users.setDefaultAddress(userId, addressId);
  }
}
