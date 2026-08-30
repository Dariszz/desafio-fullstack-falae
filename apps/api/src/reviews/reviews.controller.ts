import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  CreateReviewResponse,
  ReprocessReviewResponse,
  ReviewDetail,
  ReviewsListResponse,
} from '@falae/contracts';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Recebe uma avaliação para processamento assíncrono',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    example: 'review-order-123',
  })
  @ApiAcceptedResponse({
    description: 'Avaliação persistida ou duplicata reconhecida.',
    schema: {
      example: {
        id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
        external_id: 'review-order-123',
        status: 'pending',
        duplicate: false,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Payload ou chave de idempotência inválida.',
  })
  @ApiConflictResponse({
    description: 'A chave já existe associada a outro conteúdo.',
  })
  create(
    @Body() dto: CreateReviewDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<CreateReviewResponse> {
    return this.reviewsService.create(dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Lista avaliações com paginação e filtro opcional' })
  @ApiOkResponse({
    description: 'Avaliações ordenadas da mais recente para a mais antiga.',
    schema: {
      example: {
        data: [
          {
            id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
            external_id: 'review-order-123',
            company_id: 'company-456',
            rating: 2,
            comment: 'O pedido demorou muito e chegou frio.',
            status: 'pending',
            attempts: 0,
            analysis: null,
            alert: null,
            created_at: '2026-08-28T12:00:00.000Z',
            processed_at: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    },
  })
  list(@Query() query: ListReviewsQueryDto): Promise<ReviewsListResponse> {
    return this.reviewsService.list(query);
  }

  @Post(':id/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reagenda uma avaliação que terminou com falha' })
  @ApiAcceptedResponse({
    description: 'Avaliação retornada ao estado pendente.',
    schema: {
      example: {
        id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
        external_id: 'review-order-123',
        status: 'pending',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Identificador inválido.' })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  @ApiConflictResponse({
    description: 'A avaliação não está com status de falha.',
  })
  reprocess(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReprocessReviewResponse> {
    return this.reviewsService.reprocess(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma avaliação e sua análise atual' })
  @ApiOkResponse({
    description: 'Detalhes da avaliação.',
    schema: {
      example: {
        id: 'f88e5c5c-276f-45b1-a374-2232b4463302',
        external_id: 'review-order-123',
        company_id: 'company-456',
        rating: 2,
        comment: 'O pedido demorou muito e chegou frio.',
        status: 'completed',
        attempts: 2,
        analysis: {
          sentiment: 'negative',
          category: 'delivery',
          confidence: 0.91,
          matched_keywords: ['demorou', 'frio'],
          processed_at: '2026-08-28T12:00:04.000Z',
        },
        alert: {
          id: '2608e2ac-74b9-4546-bb6b-b93fdd8e6a23',
          type: 'negative_review',
          message: 'Avaliação negativa na categoria delivery.',
          created_at: '2026-08-28T12:00:04.000Z',
        },
        created_at: '2026-08-28T12:00:00.000Z',
        processed_at: '2026-08-28T12:00:04.000Z',
        last_error: null,
        updated_at: '2026-08-28T12:00:04.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Identificador inválido.' })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReviewDetail> {
    return this.reviewsService.findOne(id);
  }
}
