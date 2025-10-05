import { Module } from '@nestjs/common';
import { ExampleService } from './example.service';
import { ExampleController } from './example.controller';
import { AppLogger } from 'src/common/logger/logger.service';

@Module({
  controllers: [ExampleController],
  providers: [ExampleService, AppLogger],
})
export class ExampleModule {}
