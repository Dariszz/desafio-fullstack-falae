import { Injectable } from '@nestjs/common';
import {
  OutboxEventType,
  Prisma,
  type Review,
  type ReviewStatus,
} from '@falae/database';
import { DatabaseService } from '../database/database.service.js';

export interface CreateReviewData {
  externalId: string;
  companyId: string;
  rating: number;
  comment: string;
}

export interface CreateOrGetResult {
  review: Review;
  created: boolean;
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly database: DatabaseService) {}

  async createOrGet(data: CreateReviewData): Promise<CreateOrGetResult> {
    try {
      return await this.database.client.$transaction(async (transaction) => {
        const existing = await transaction.review.findUnique({
          where: {
            companyId_externalId: {
              companyId: data.companyId,
              externalId: data.externalId,
            },
          },
        });

        if (existing) {
          return { review: existing, created: false };
        }

        const review = await transaction.review.create({ data });

        await transaction.outboxEvent.create({
          data: {
            reviewId: review.id,
            type: OutboxEventType.REVIEW_CREATED,
            payload: {
              review_id: review.id,
              external_id: review.externalId,
              company_id: review.companyId,
              rating: review.rating,
              comment: review.comment,
            },
          },
        });

        return { review, created: true };
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.findByExternalId(
        data.companyId,
        data.externalId,
      );

      if (!existing) {
        throw error;
      }

      return { review: existing, created: false };
    }
  }

  findByExternalId(
    companyId: string,
    externalId: string,
  ): Promise<Review | null> {
    return this.database.client.review.findUnique({
      where: { companyId_externalId: { companyId, externalId } },
    });
  }

  findById(id: string): Promise<Review | null> {
    return this.database.client.review.findUnique({ where: { id } });
  }

  async list(options: {
    status?: ReviewStatus;
    skip: number;
    take: number;
  }): Promise<{ reviews: Review[]; total: number }> {
    const where = options.status ? { status: options.status } : undefined;
    const [reviews, total] = await this.database.client.$transaction([
      this.database.client.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: options.skip,
        take: options.take,
      }),
      this.database.client.review.count({ where }),
    ]);

    return { reviews, total };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
