import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FindOptionsWhere } from 'typeorm';

import type { AdminReviewQueryDto, CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from './dto/review.dto.js';
import { NotificationService } from '../notification/notification.service.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { Review } from '../../database/model/review.model.js';
import type { User } from '../../database/model/user.model.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { ReviewRepository } from '../../database/repository/review.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { isUniqueViolation } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum, OrderStatusEnum, ReviewStatusEnum, WatchStatusEnum } from '../../dependency/value/database.enum.js';
import { SystemRoleEnum } from '../../dependency/value/security.enum.js';

/** Reviewer info shown publicly: first name only. */
const reviewer = (user?: User) => (user ? { id: user.id, name: user.name.split(' ')[0] } : null);

/**
 * Reviews are moderated: new and edited reviews are PENDING until an admin approves them.
 * Only APPROVED reviews are public and count towards the watch rating.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly watches: WatchRepository,
    private readonly orders: OrderRepository,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
  ) {}

  async listForWatch(watchId: string, { page, limit, sortBy, sortOrder }: ReviewQueryDto) {
    const column = sortColumn(sortBy, { createdAt: 'createdAt', rating: 'rating' }, 'createdAt');
    const result = await this.reviews.paginate({
      where: { watchId, status: ReviewStatusEnum.APPROVED },
      page,
      size: limit,
      options: { relations: { user: true }, order: { [column]: sortDirection(sortOrder) } },
    });
    return { ...result, docs: result.docs.map(({ user, ...review }) => ({ ...review, user: reviewer(user) })) };
  }

  async create(userId: string, watchId: string, input: CreateReviewDto) {
    const watch = await this.watches.findOne({ where: { id: watchId, status: WatchStatusEnum.PUBLISHED }, options: { select: { id: true, name: true } } });
    if (!watch) throw new NotFoundException('Watch not found');

    // "Verified purchase" when the customer has a delivered order containing this watch.
    const purchase = await this.orders
      .repo()
      .createQueryBuilder('order')
      .innerJoin('order.items', 'item', 'item.watchId = :watchId', { watchId })
      .where('order.userId = :userId', { userId })
      .andWhere('order.status IN (:...statuses)', { statuses: [OrderStatusEnum.DELIVERED, OrderStatusEnum.RETURN_REQUESTED, OrderStatusEnum.RETURNED] })
      .orderBy('order.createdAt', 'DESC')
      .select(['order.id'])
      .getOne();

    let review: Review;
    try {
      review = await this.reviews.create({
        data: { ...input, userId, watchId, orderId: purchase?.id ?? null, isVerifiedPurchase: !!purchase, status: ReviewStatusEnum.PENDING },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('You have already reviewed this watch. Edit your review instead');
      throw error;
    }

    this.realtime.emitToAdmins(RealtimeEvent.ADMIN_REVIEW_NEW, { reviewId: review.id, watchId, watchName: watch.name, rating: review.rating });
    return review;
  }

  /** Editing sends the review back to moderation. */
  async update(userId: string, reviewId: string, input: UpdateReviewDto) {
    const review = await this.reviews.findOne({ where: { id: reviewId, userId } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.reviews.findByIdAndUpdate({ id: review.id, data: { ...input, status: ReviewStatusEnum.PENDING, rejectionReason: null } });
    if (review.status === ReviewStatusEnum.APPROVED) await this.refreshRating(review.watchId);
    this.realtime.emitToAdmins(RealtimeEvent.ADMIN_REVIEW_NEW, { reviewId: review.id, watchId: review.watchId, rating: updated!.rating, edited: true });
    return updated;
  }

  /** Owners delete their own reviews; admins can delete any. */
  async remove(user: User, reviewId: string) {
    const isAdmin = user.role === SystemRoleEnum.ADMIN || user.role === SystemRoleEnum.SUPER_ADMIN;
    const where: FindOptionsWhere<Review> = isAdmin ? { id: reviewId } : { id: reviewId, userId: user.id };
    const review = await this.reviews.findOneAndDelete({ where });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === ReviewStatusEnum.APPROVED) await this.refreshRating(review.watchId);
    return { deleted: true };
  }

  // ── Admin moderation ──

  adminList({ page, limit, status, watchId, sortOrder }: AdminReviewQueryDto) {
    const where: FindOptionsWhere<Review> = {};
    if (status) where.status = status;
    if (watchId) where.watchId = watchId;
    return this.reviews.paginate({
      where,
      page,
      size: limit,
      options: { relations: { user: true, watch: true }, order: { createdAt: sortDirection(sortOrder) } },
    });
  }

  approve(reviewId: string) {
    return this.moderate(reviewId, ReviewStatusEnum.APPROVED, null);
  }

  reject(reviewId: string, reason: string) {
    return this.moderate(reviewId, ReviewStatusEnum.REJECTED, reason);
  }

  private async moderate(reviewId: string, status: ReviewStatusEnum, rejectionReason: string | null) {
    const review = await this.reviews.findOne({ where: { id: reviewId }, options: { relations: { watch: true } } });
    if (!review) throw new NotFoundException('Review not found');

    await this.reviews.updateMany({ where: { id: review.id }, data: { status, rejectionReason } });
    await this.refreshRating(review.watchId);

    const approved = status === ReviewStatusEnum.APPROVED;
    await this.notifications.notify({
      userId: review.userId,
      type: NotificationTypeEnum.REVIEW,
      title: approved ? 'Review published' : 'Review not published',
      message: approved ? `Your review of ${review.watch?.name} is now live.` : `Your review of ${review.watch?.name} was not published: ${rejectionReason}`,
      referenceId: review.watchId,
      data: { reviewId: review.id, status },
    });
    return { ...review, status, rejectionReason };
  }

  /** Recomputes the watch's average rating and count from approved reviews. */
  private async refreshRating(watchId: string) {
    await this.watches.repo().query(
      `UPDATE watches SET
         rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE watch_id = $1 AND status = $2), 0),
         rating_count   = (SELECT COUNT(*) FROM reviews WHERE watch_id = $1 AND status = $2)
       WHERE id = $1`,
      [watchId, ReviewStatusEnum.APPROVED],
    );
  }
}
