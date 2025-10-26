import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReorderProjectDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;
}
