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
  alert: {
    id: '2608e2ac-74b9-4546-bb6b-b93fdd8e6a23',
    type: 'negative_review',
    message: 'Avaliação negativa na categoria delivery.',
    created_at: '2026-08-29T12:00:02.000Z',
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
    expect(screen.getByText('Alerta negativo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver detalhes/i }));

    expect(
      await screen.findByText(/atenção: avaliação negativa/i),
    ).toBeInTheDocument();
    expect(await screen.findByText('Negativo')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('delivery')).toBeInTheDocument();
  });

  it('mantém o foco no drawer, fecha com Escape e restaura o acionador', async () => {
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

    const trigger = await screen.findByRole('button', {
      name: /ver detalhes/i,
    });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = screen.getByRole('button', {
      name: /fechar detalhes/i,
    });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(closeButton).toHaveFocus();

    const shiftTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
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

  it('oculta a lista anterior enquanto um novo filtro está carregando', async () => {
    let resolveFilteredRequest: ((value: Response) => void) | undefined;
    const filteredRequest = new Promise<Response>((resolve) => {
      resolveFilteredRequest = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [review], meta: meta(1) }))
      .mockReturnValueOnce(filteredRequest);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('company-456')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pendentes' }));

    expect(
      await screen.findByLabelText(/carregando avaliações/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('company-456')).not.toBeInTheDocument();

    resolveFilteredRequest?.(response({ data: [], meta: meta(0) }));
    expect(
      await screen.findByText(/não há avaliações com esse status/i),
    ).toBeInTheDocument();
  });

  it('carrega páginas adicionais sem remover as avaliações anteriores', async () => {
    const secondReview: ReviewSummary = {
      ...review,
      id: '476ec11f-ea8a-4aa2-b21e-95d177286e67',
      external_id: 'review-order-456',
      company_id: 'company-789',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          data: [review],
          meta: { page: 1, limit: 20, total: 21, total_pages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: [secondReview],
          meta: { page: 2, limit: 20, total: 21, total_pages: 2 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('company-456')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    expect(await screen.findByText('company-789')).toBeInTheDocument();
    expect(screen.getByText('company-456')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /carregar mais/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/reviews?page=2');
  });

  it('reprocessa uma avaliação com falha e atualiza seu status', async () => {
    const failedReview: ReviewSummary = {
      ...review,
      status: 'failed',
      attempts: 4,
      analysis: null,
      alert: null,
      processed_at: '2026-08-29T12:00:08.000Z',
    };
    const pendingReview: ReviewSummary = {
      ...failedReview,
      status: 'pending',
      attempts: 0,
      processed_at: null,
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [failedReview], meta: meta(1) }))
      .mockResolvedValueOnce(
        response(
          {
            id: review.id,
            external_id: review.external_id,
            status: 'pending',
          },
          202,
        ),
      )
      .mockResolvedValueOnce(
        response({ data: [pendingReview], meta: meta(1) }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    );

    expect(
      await screen.findByText(/avaliação reenviada.*segundo plano/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const reprocessCall = fetchMock.mock.calls[1];
    expect(reprocessCall?.[0]).toBe(`/api/reviews/${review.id}/reprocess`);
    expect(reprocessCall?.[1]?.method).toBe('POST');
  });

  it('mantém disponível a ação quando o reprocessamento falha', async () => {
    const failedReview: ReviewSummary = {
      ...review,
      status: 'failed',
      attempts: 4,
      analysis: null,
      alert: null,
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: [failedReview], meta: meta(1) }))
      .mockResolvedValueOnce(
        response({ message: 'A avaliação já teve seu estado alterado.' }, 409),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    );

    expect(
      await screen.findByText(/já teve seu estado alterado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tentar novamente/i }),
    ).toBeEnabled();
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
