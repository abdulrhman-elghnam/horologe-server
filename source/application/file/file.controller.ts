import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Query, StreamableFile } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';

import { UserRepository } from '../../database/repository/user.repository.js';
import { WatchImageRepository } from '../../database/repository/watch-image.repository.js';
import { SignedUrl, type SignedFileKind } from '../../dependency/presenter.js';
import { StorageService } from '../../dependency/service/storage.service.js';

/**
 * Serves stored files through the signed URLs produced by `SignedUrl.sign(kind, id)`.
 * No auth header needed: the HMAC signature is the permission and expires within two hours.
 */
@ApiTags('Files')
@Controller('files')
export class FileController {
  constructor(
    private readonly storage: StorageService,
    private readonly users: UserRepository,
    private readonly images: WatchImageRepository,
  ) {}

  @ApiParam({ name: 'kind', enum: ['image', 'avatar'] })
  @ApiProduces('image/jpeg', 'image/png')
  @ApiOkResponse({ description: 'The file bytes', schema: { type: 'string', format: 'binary' } })
  @ApiForbiddenResponse({ description: 'Invalid or expired signature' })
  @Get(':kind/:id')
  async serve(@Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Query('exp') exp: string, @Query('sig') sig: string) {
    if (!SignedUrl.verify(kind, id, exp, sig)) throw new ForbiddenException('Invalid or expired file link');

    const { key, mimeType } = await this.locate(kind as SignedFileKind, id);
    const data = await this.storage.read(key);
    return new StreamableFile(data, { type: mimeType, disposition: 'inline', length: data.length });
  }

  private async locate(kind: SignedFileKind, id: string): Promise<{ key: string; mimeType: string }> {
    if (kind === 'avatar') {
      const user = await this.users.findById({ id, options: { select: { id: true, avatarKey: true } } });
      if (user?.avatarKey) return { key: user.avatarKey, mimeType: user.avatarKey.includes('.png.') ? 'image/png' : 'image/jpeg' };
    }
    if (kind === 'image') {
      const image = await this.images.findById({ id, options: { select: { id: true, storageKey: true, mimeType: true } } });
      if (image) return { key: image.storageKey, mimeType: image.mimeType };
    }
    throw new NotFoundException('File not found');
  }
}
