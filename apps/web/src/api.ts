import type {
  CreateReviewResponse,
  ReviewDetail,
  ReviewsListResponse,
  ReviewStatus,
} from '@falae/contracts';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface CreateReviewInput {
  external_id: string;
  company_id: string;
  rating: number;
  comment: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function listReviews(
  status?: ReviewStatus,
): Promise<ReviewsListResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<ReviewsListResponse>(`/reviews${query}`);
}

export function getReview(id: string): Promise<ReviewDetail> {
  return request<ReviewDetail>(`/reviews/${encodeURIComponent(id)}`);
}

export function createReview(
  input: CreateReviewInput,
): Promise<CreateReviewResponse> {
  return request<CreateReviewResponse>('/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.external_id,
    },
    body: JSON.stringify(input),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(
      'Não foi possível falar com a API. Verifique sua conexão e tente novamente.',
      0,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload), response.status);
  }

  return payload as T;
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) {
    return 'A API retornou uma resposta inesperada.';
  }

  const message = payload.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string'
    ? message
    : 'A API retornou uma resposta inesperada.';
}
