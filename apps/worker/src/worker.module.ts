import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseService } from './database.service.js';
import { OutboxPublisher } from './outbox.publisher.js';
import { QueueService } from './queue.service.js';
import { MetricsServer } from './metrics.server.js';
import { MetricsService } from './metrics.service.js';
import { AnalysisClient } from './analysis/analysis.client.js';
import { AnalysisWorker } from './analysis/analysis.worker.js';
import { ReviewProcessor } from './analysis/review.processor.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    DatabaseService,
    MetricsService,
    MetricsServer,
    QueueService,
    OutboxPublisher,
    AnalysisClient,
    ReviewProcessor,
    AnalysisWorker,
  ],
})
export class WorkerModule {}
