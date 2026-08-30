import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  imports: [MetricsModule, DatabaseModule, ReviewsModule],
  controllers: [AppController],
})
export class AppModule {}
