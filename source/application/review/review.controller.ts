import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminReviewQueryDto, CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from './dto/review.dto.js';
import { ReviewService } from './review.service.js';
import type { User } from '../../database/model/user.model.js';
import { AdminOnly, Auth, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';
import { ReasonDto } from '../../dependency/dto/common.dto.js';

@ApiTags('Reviews')
@Controller()
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('watches/:watchId/reviews')
  list(@Param('watchId', ParseUUIDPipe) watchId: string, @Query() query: ReviewQueryDto) {
    return this.reviews.listForWatch(watchId, query);
  }

  @Auth()
  @Post('watches/:watchId/reviews')
  create(@CurrentUser('id') userId: string, @Param('watchId', ParseUUIDPipe) watchId: string, @Body() body: CreateReviewDto) {
    return this.reviews.create(userId, watchId, body);
  }

  @Auth()
  @Patch('reviews/:reviewId')
  update(@CurrentUser('id') userId: string, @Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() body: UpdateReviewDto) {
    return this.reviews.update(userId, reviewId, body);
  }

  @Auth()
  @Delete('reviews/:reviewId')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: User, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviews.remove(user, reviewId);
  }
}

@AdminOnly()
@ApiTags('Admin · Reviews')
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  list(@Query() query: AdminReviewQueryDto) {
    return this.reviews.adminList(query);
  }

  @Audit('review.approve', 'review', 'reviewId')
  @Patch(':reviewId/approve')
  approve(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviews.approve(reviewId);
  }

  @Audit('review.reject', 'review', 'reviewId')
  @Patch(':reviewId/reject')
  reject(@Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() { reason }: ReasonDto) {
    return this.reviews.reject(reviewId, reason);
  }
}
