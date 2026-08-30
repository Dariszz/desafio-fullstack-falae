import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateReviewResponse,
  ReprocessReviewResponse,
  ReviewDetail,
  ReviewsListResponse,
} from '@falae/contracts';
import { ReviewStatus } from '@falae/database';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import {
  toApiReviewStatus,
  toDatabaseReviewStatus,
  toReviewDetail,
  toReviewSummary,
} from './review.mapper.js';
import { ReviewsRepository } from './reviews.repository.js';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly repository: ReviewsRepository,
    private readonly metrics: MetricsService,
  ) {}

  async create(
    dto: CreateReviewDto,
    idempotencyKey: string | undefined,
  ): Promise<CreateReviewResponse> {
    const data = {
      externalId: dto.external_id.trim(),
      companyId: dto.company_id.trim(),
      rating: dto.rating,
      comment: dto.comment.trim(),
    };
    const normalizedKey = idempotencyKey?.trim();

    if (!normalizedKey) {
      throw new BadRequestException('O header Idempotency-Key é obrigatório.');
    }

    if (normalizedKey.length > 100) {
      throw new BadRequestException(
        'O header Idempotency-Key deve ter no máximo 100 caracteres.',
      );
    }

    if (normalizedKey !== data.externalId) {
      throw new BadRequestException(
        'Idempotency-Key deve ser igual ao campo external_id.',
      );
    }

    if (data.comment.length < 3) {
      throw new BadRequestException(
        'comment deve ter ao menos 3 caracteres desconsiderando espaços externos.',
      );
    }

    const result = await this.repository.createOrGet(data);

    if (!result.created && !this.hasSameContent(result.review, data)) {
      this.metrics.recordReview('idempotency_conflict');
      this.logger.warn({
        event: 'review.idempotency_conflict',
        review_id: result.review.id,
        external_id: result.review.externalId,
        company_id: result.review.companyId,
      });
      throw new ConflictException(
        'Já existe uma avaliação com o mesmo external_id e conteúdo diferente.',
      );
    }

    this.metrics.recordReview(result.created ? 'created' : 'duplicate');

    this.logger.log({
      event: result.created ? 'review.created' : 'review.duplicate_recognized',
      review_id: result.review.id,
      external_id: result.review.externalId,
      company_id: result.review.companyId,
      status: toApiReviewStatus(result.review.status),
    });
    return {
      id: result.review.id,
      external_id: result.review.externalId,
      status: toApiReviewStatus(result.review.status),
      duplicate: !result.created,
    };
  }

  async list(query: ListReviewsQueryDto): Promise<ReviewsListResponse> {
    const { page, limit } = query;
    const result = await this.repository.list({
      status: query.status ? toDatabaseReviewStatus(query.status) : undefined,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: result.reviews.map(toReviewSummary),
      meta: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ReviewDetail> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    return toReviewDetail(review);
  }

  async reprocess(id: string): Promise<ReprocessReviewResponse> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    if (review.status !== ReviewStatus.FAILED) {
      throw new ConflictException(
        'Somente avaliações com falha podem ser reprocessadas.',
      );
    }

    const reprocessed = await this.repository.reprocessFailed(id);

    if (!reprocessed) {
      throw new ConflictException(
        'A avaliação já foi reprocessada ou teve seu estado alterado.',
      );
    }

    this.logger.log({
      event: 'review.reprocess_requested',
      review_id: reprocessed.id,
      external_id: reprocessed.externalId,
      company_id: reprocessed.companyId,
      status: toApiReviewStatus(reprocessed.status),
    });
    this.metrics.recordReview('reprocessed');

    return {
      id: reprocessed.id,
      external_id: reprocessed.externalId,
      status: toApiReviewStatus(reprocessed.status),
    };
  }

  private hasSameContent(
    review: {
      companyId: string;
      rating: number;
      comment: string;
    },
    data: {
      companyId: string;
      rating: number;
      comment: string;
    },
  ): boolean {
    return (
      review.companyId === data.companyId &&
      review.rating === data.rating &&
      review.comment === data.comment
    );
  }
}
