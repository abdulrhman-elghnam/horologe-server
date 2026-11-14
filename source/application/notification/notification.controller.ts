import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { NotificationQueryDto } from './dto/notification.dto.js';
import { NotificationService } from './notification.service.js';
import { Auth, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@Auth()
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query() query: NotificationQueryDto) {
    return this.notifications.list(userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  // Declared before ':notificationId/read' so "read-all" is not parsed as an id.
  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':notificationId/read')
  markRead(@CurrentUser('id') userId: string, @Param('notificationId', ParseUUIDPipe) notificationId: string) {
    return this.notifications.markRead(userId, notificationId);
  }

  @Delete(':notificationId')
  remove(@CurrentUser('id') userId: string, @Param('notificationId', ParseUUIDPipe) notificationId: string) {
    return this.notifications.remove(userId, notificationId);
  }

  @Delete()
  removeAll(@CurrentUser('id') userId: string) {
    return this.notifications.removeAll(userId);
  }
}
