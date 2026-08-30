import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ReviewStatus as DatabaseReviewStatus,
  type Review,
} from '@falae/database';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { ReviewsRepository } from './reviews.repository.js';
import { ReviewsService } from './reviews.service.js';

type RepositoryMock = jest.Mocked<
  Pick<
    ReviewsRepository,
    'createOrGet' | 'findById' | 'list' | 'reprocessFailed'
  >
>;

describe('ReviewsService', () => {
  let repository: RepositoryMock;
  let service: ReviewsService;

  beforeEach(() => {
    repository = {
      createOrGet: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      reprocessFailed: jest.fn(),
    };
    service = new ReviewsService(repository as unknown as ReviewsRepository);
  });

  it('creates a review with a matching idempotency key', async () => {
    repository.createOrGet.mockResolvedValue({
      review: makeReview(),
      created: true,
    });

    await expect(
      service.create(makeDto(), 'review-order-123'),
    ).resolves.toEqual({
      id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
      external_id: 'review-order-123',
      status: 'pending',
      duplicate: false,
    });
    expect(repository.createOrGet).toHaveBeenCalledWith({
      externalId: 'review-order-123',
      companyId: 'company-456',
      rating: 2,
      comment: 'O pedido demorou muito e chegou frio.',
    });
  });

  it('recognizes an equivalent duplicate', async () => {
    repository.createOrGet.mockResolvedValue({
      review: makeReview(),
      created: false,
    });

    await expect(
      service.create(makeDto(), 'review-order-123'),
    ).resolves.toMatchObject({ duplicate: true });
  });

  it('rejects a duplicate key associated with different content', async () => {
    repository.createOrGet.mockResolvedValue({
      review: makeReview({ rating: 5 }),
      created: false,
    });

    await expect(
      service.create(makeDto(), 'review-order-123'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([undefined, '', 'another-key'])(
    'rejects an invalid idempotency key: %s',
    async (key) => {
      await expect(service.create(makeDto(), key)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.createOrGet).not.toHaveBeenCalled();
    },
  );

  it('rejects a comment that is too short after trimming', async () => {
    const dto = makeDto();
    dto.comment = ' a ';

    await expect(
      service.create(dto, 'review-order-123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createOrGet).not.toHaveBeenCalled();
  });

  it('returns paginated reviews', async () => {
    repository.list.mockResolvedValue({ reviews: [makeReview()], total: 21 });
    const query = new ListReviewsQueryDto();
    query.page = 2;
    query.limit = 10;
    query.status = 'pending';

    const result = await service.list(query);

    expect(repository.list).toHaveBeenCalledWith({
      status: DatabaseReviewStatus.PENDING,
      skip: 10,
      take: 10,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      total_pages: 3,
    });
    expect(result.data[0]).toMatchObject({
      external_id: 'review-order-123',
      status: 'pending',
      analysis: null,
    });
  });

  it('throws when a review does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.findOne('934f0799-4826-4aa7-b167-e830ab6f6256'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reprocesses a failed review and returns it to pending', async () => {
    repository.findById.mockResolvedValue(
      makeReview({ status: DatabaseReviewStatus.FAILED, attempts: 4 }),
    );
    repository.reprocessFailed.mockResolvedValue(makeReview());

    await expect(
      service.reprocess('f88e5c5c-276f-45b1-a374-2232b4463302'),
    ).resolves.toEqual({
      id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
      external_id: 'review-order-123',
      status: 'pending',
    });
    expect(repository.reprocessFailed).toHaveBeenCalledWith(
      'f88e5c5c-276f-45b1-a374-2232b4463302',
    );
  });

  it('rejects reprocessing when the review is not failed', async () => {
    repository.findById.mockResolvedValue(makeReview());

    await expect(
      service.reprocess('f88e5c5c-276f-45b1-a374-2232b4463302'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.reprocessFailed).not.toHaveBeenCalled();
  });

  it('throws when the review to reprocess does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.reprocess('f88e5c5c-276f-45b1-a374-2232b4463302'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.reprocessFailed).not.toHaveBeenCalled();
  });

  it('rejects a concurrent reprocessing attempt', async () => {
    repository.findById.mockResolvedValue(
      makeReview({ status: DatabaseReviewStatus.FAILED }),
    );
    repository.reprocessFailed.mockResolvedValue(null);

    await expect(
      service.reprocess('f88e5c5c-276f-45b1-a374-2232b4463302'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function makeDto(): CreateReviewDto {
  return {
    external_id: ' review-order-123 ',
    company_id: ' company-456 ',
    rating: 2,
    comment: ' O pedido demorou muito e chegou frio. ',
  };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  const timestamp = new Date('2026-08-28T12:00:00.000Z');

  return {
    id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
    externalId: 'review-order-123',
    companyId: 'company-456',
    rating: 2,
    comment: 'O pedido demorou muito e chegou frio.',
    status: DatabaseReviewStatus.PENDING,
    attempts: 0,
    lastError: null,
    analysisSentiment: null,
    analysisCategory: null,
    analysisConfidence: null,
    analysisKeywords: null,
    analysisRequestId: null,
    analysisProcessedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    processedAt: null,
    ...overrides,
  };
}
