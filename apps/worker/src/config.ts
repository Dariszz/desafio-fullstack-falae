export interface WorkerConfig {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  analysisApiUrl: string;
  analysisTimeoutMs: number;
  maxAttempts: number;
  metricsPort: number;
  outboxRetentionDays: number;
}

export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return {
    databaseUrl: required(env.DATABASE_URL, 'DATABASE_URL'),
    redisHost: env.REDIS_HOST?.trim() || 'localhost',
    redisPort: positiveInteger(env.REDIS_PORT, 6379),
    redisPassword: env.REDIS_PASSWORD?.trim() || 'falae_local',
    analysisApiUrl: env.ANALYSIS_API_URL?.trim() || 'http://localhost:4000',
    analysisTimeoutMs: positiveInteger(env.ANALYSIS_TIMEOUT_MS, 5000),
    maxAttempts: positiveInteger(env.REVIEW_MAX_ATTEMPTS, 4),
    metricsPort: positiveInteger(env.WORKER_METRICS_PORT, 3002),
    outboxRetentionDays: positiveInteger(env.OUTBOX_RETENTION_DAYS, 30),
  };
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} não foi configurada.`);
  return value.trim();
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Configuração numérica inválida.');
  }
  return parsed;
}
