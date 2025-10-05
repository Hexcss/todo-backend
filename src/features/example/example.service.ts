import { Injectable } from '@nestjs/common';
import { Example } from './entities/example.entity';
import { CreateExampleDto } from './dto/create-example.dto';
import { AppLogger } from 'src/common/logger/logger.service';

@Injectable()
export class ExampleService {
  private readonly examples: Example[] = [];

  constructor(private readonly logger: AppLogger) {}

  create(dto: CreateExampleDto): Example {
    const example: Example = {
      id: (this.examples.length + 1).toString(),
      name: dto.name,
    };
    this.examples.push(example);
    this.logger.log(`Created Example with id ${example.id}`, 'ExampleService');
    return example;
  }

  findAll(): Example[] {
    this.logger.debug('Fetching all examples', 'ExampleService');
    return this.examples;
  }
}
