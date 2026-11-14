import { Module } from '@nestjs/common';

import { AdminReviewController, ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [NotificationModule],
  controllers: [ReviewController, AdminReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
