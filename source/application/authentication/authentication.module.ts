import { Module } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller.js';
import { AuthenticationService } from './authentication.service.js';
import { SuperAdminSeeder } from './super-admin.seeder.js';
import { RealtimeModule } from '../_realtime_/realtime.module.js';


@Module({
  imports: [RealtimeModule],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, SuperAdminSeeder],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
