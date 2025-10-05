import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExampleService } from './example.service';
import { CreateExampleDto } from './dto/create-example.dto';
import { Example } from './entities/example.entity';

@ApiTags('Example')
@Controller('examples')
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Get()
  getAll(): Example[] {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateExampleDto): Example {
    return this.service.create(dto);
  }
}
