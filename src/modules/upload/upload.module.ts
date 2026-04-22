import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { SummaryModule } from '../../summary/summary.module';

@Module({
  imports: [SummaryModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
