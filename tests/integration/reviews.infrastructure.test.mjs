import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import pg from 'pg';

const apiUrl = process.env.INTEGRATION_API_URL;
const databaseUrl = process.env.DATABASE_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT ?? 6379);

assert.ok(apiUrl, 'INTEGRATION_API_URL precisa estar configurada.');
assert.ok(databaseUrl, 'DATABASE_URL precisa estar configurada.');
assert.ok(redisHost, 'REDIS_HOST precisa estar configurado.');

const database = new pg.Pool({ connectionString: databaseUrl });
const redis = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});
const queue = new Queue('review-analysis', {
  connection: { host: redisHost, port: redisPort },
});
const createdReviewIds = [];

after(async () => {
  if (createdReviewIds.length > 0) {
    await database.query('DELETE FROM reviews WHERE id = ANY($1::uuid[])', [
      createdReviewIds,
    ]);
  }
  await queue.obliterate({ force: true });
  await queue.close();
  await redis.quit();
  await database.end();
});

test('PostgreSQL e Redis reais estão disponíveis', async () => {
  const databaseResult = await database.query('SELECT 1 AS value');

  assert.equal(databaseResult.rows[0]?.value, 1);
  assert.equal(await redis.ping(), 'PONG');
});

test('persiste idempotentemente, publica o outbox e processa no Redis', async () => {
  const externalId = `integration-${randomUUID()}`;
  const input = {
    external_id: externalId,
    company_id: 'integration-company',
    rating: 1,
    comment: 'O pedido demorou muito e chegou frio.',
  };

  const first = await createReview(input);
  assert.equal(first.statusCode, 202);
  assert.equal(first.body.duplicate, false);
  assert.ok(first.body.id);
  createdReviewIds.push(first.body.id);

  const duplicate = await createReview(input);
  assert.equal(duplicate.statusCode, 202);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.id, first.body.id);

  const detail = await waitForCompletion(first.body.id);

  assert.equal(detail.status, 'completed');
  assert.equal(detail.analysis?.sentiment, 'negative');
  assert.equal(detail.alert?.type, 'negative_review');

  const persisted = await database.query(
    `SELECT
       (SELECT COUNT(*)::int FROM reviews WHERE id = $1) AS review_count,
       (SELECT COUNT(*)::int FROM outbox_events WHERE review_id = $1) AS outbox_count,
       (SELECT COUNT(*)::int FROM review_alerts WHERE review_id = $1) AS alert_count`,
    [first.body.id],
  );

  assert.deepEqual(persisted.rows[0], {
    review_count: 1,
    outbox_count: 1,
    alert_count: 1,
  });

  const outbox = await database.query(
    `SELECT id, published_at, attempts
     FROM outbox_events
     WHERE review_id = $1`,
    [first.body.id],
  );
  const event = outbox.rows[0];

  assert.ok(event?.published_at);
  assert.ok(event.attempts >= 1);

  const job = await queue.getJob(event.id);

  assert.ok(job, 'O job do outbox deve existir no Redis.');
  assert.equal(job.data.reviewId, first.body.id);
  assert.equal(await job.getState(), 'completed');
});

async function createReview(input) {
  const response = await globalThis.fetch(`${apiUrl}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.external_id,
    },
    body: JSON.stringify(input),
  });

  return { statusCode: response.status, body: await response.json() };
}

async function waitForCompletion(reviewId) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const response = await globalThis.fetch(`${apiUrl}/reviews/${reviewId}`);
    const body = await response.json();

    assert.equal(response.status, 200);

    if (body.status === 'completed') return body;
    if (body.status === 'failed') {
      throw new Error(
        `A análise falhou: ${body.last_error ?? 'erro desconhecido'}`,
      );
    }
    await delay(250);
  }

  throw new Error('Tempo limite excedido aguardando o processamento.');
}
