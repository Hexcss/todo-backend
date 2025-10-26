import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

export class BulkTaskAction {
  @ApiProperty({ enum: ['create','update','delete','softDelete','restore','move','reorder','archive','unarchive','complete','uncomplete'] as const })
  @IsIn(['create','update','delete','softDelete','restore','move','reorder','archive','unarchive','complete','uncomplete'])
  op: 'create'|'update'|'delete'|'softDelete'|'restore'|'move'|'reorder'|'archive'|'unarchive'|'complete'|'uncomplete';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ type: () => CreateTaskDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTaskDto)
  data?: CreateTaskDto;

  @ApiPropertyOptional({ type: () => UpdateTaskDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTaskDto)
  update?: UpdateTaskDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class BulkTasksDto {
  @ApiProperty({ type: [BulkTaskAction] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTaskAction)
  actions: BulkTaskAction[];
}
