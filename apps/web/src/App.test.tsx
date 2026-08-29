import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReviewDetail, ReviewSummary } from '@falae/contracts';
import { App } from './App.js';

const review: ReviewSummary = {
  id: '8cf43ec8-e1dc-4ee8-afaa-401163ba8614',
  external_id: 'review-order-123',
  company_id: 'company-456',
  rating: 2,
  comment: 'O pedido demorou muito e chegou frio.',
  status: 'completed',
  attempts: 1,
  analysis: {
    sentiment: 'negative',
    category: 'delivery',
    confidence: 0.91,
    matched_keywords: ['demorou', 'frio'],
    processed_at: '2026-08-29T12:00:02.000Z',
  },
  created_at: '2026-08-29T12:00:00.000Z',
  processed_at: '2026-08-29T12:00:02.000Z',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('lista avaliações e exibe o resultado completo sob demanda', async () => {
    const detail: ReviewDetail = {
      ...review,
      last_error: null,
      updated_at: '2026-08-29T12:00:02.000Z',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [review], meta: meta(1) }))
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('company-456')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver detalhes/i }));

    expect(await screen.findByText('Negativo')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('delivery')).toBeInTheDocument();
  });

  it('envia o formulário com a chave de idempotência e atualiza a lista', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [], meta: meta(0) }))
      .mockResolvedValueOnce(
        response({
          id: review.id,
          external_id: review.external_id,
          status: 'pending',
          duplicate: false,
        }),
      )
      .mockResolvedValueOnce(response({ data: [review], meta: meta(1) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText(/nenhuma avaliação por aqui/i);

    fireEvent.change(screen.getByLabelText(/id da avaliação/i), {
      target: { value: review.external_id },
    });
    fireEvent.change(screen.getByLabelText(/id da empresa/i), {
      target: { value: review.company_id },
    });
    fireEvent.click(screen.getByLabelText('2'));
    fireEvent.change(screen.getByLabelText(/comentário/i), {
      target: { value: review.comment },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /enviar para análise/i }),
    );

    expect(
      await screen.findByText(/avaliação recebida.*segundo plano/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchMock.mock.calls as Array<
      [string | URL | Request, RequestInit?]
    >;
    const secondCall = calls[1];
    expect(secondCall).toBeDefined();
    if (!secondCall) throw new Error('A chamada POST não foi realizada.');
    const [url, options] = secondCall;
    expect(url).toBe('/api/reviews');
    expect(options?.method).toBe('POST');
    expect(
      (options?.headers as Record<string, string>)['Idempotency-Key'],
    ).toBe(review.external_id);
    expect(await screen.findByText('company-456')).toBeInTheDocument();
  });

  it('comunica erro de conexão e permite tentar novamente', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response({ data: [], meta: meta(0) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByText(/não conseguimos carregar as avaliações/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(/nenhuma avaliação por aqui/i),
    ).toBeInTheDocument();
  });
});

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function meta(total: number) {
  return { page: 1, limit: 20, total, total_pages: total > 0 ? 1 : 0 };
}
