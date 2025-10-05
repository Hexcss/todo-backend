import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateExampleDto {
  @ApiProperty()
  @IsString()
  name: string;
}
