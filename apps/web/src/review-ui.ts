import type { ReviewStatus } from '@falae/contracts';
import { ApiError } from './api.js';

export const REVIEW_STATUS: Record<
  ReviewStatus,
  { label: string; description: string }
> = {
  pending: { label: 'Pendente', description: 'Aguardando processamento' },
  processing: { label: 'Processando', description: 'Análise em andamento' },
  completed: { label: 'Concluída', description: 'Análise disponível' },
  failed: { label: 'Falhou', description: 'Não foi possível analisar' },
};

export const REVIEW_FILTERS: Array<{
  value: ReviewStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'processing', label: 'Processando' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'failed', label: 'Falhas' },
];

export interface NoticeMessage {
  kind: 'success' | 'error';
  text: string;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function translateSentiment(sentiment: string): string {
  return (
    { positive: 'Positivo', neutral: 'Neutro', negative: 'Negativo' }[
      sentiment
    ] ?? sentiment
  );
}

export function messageFrom(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Algo inesperado aconteceu.';
}
