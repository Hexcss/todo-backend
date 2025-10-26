import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdentityGuard } from 'src/shared/identity/identity.guard';
import { AuthUser } from 'src/shared/identity/auth-user.decorator';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskEntity } from './entities/task.entity';
import { ListTasksQueryDto } from './dto/list-tasks.query';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { BulkTasksDto } from './dto/bulk-tasks.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  @ApiOkResponse({ type: [TaskEntity] })
  async list(@AuthUser() user: any, @Query() query: ListTasksQueryDto) {
    return this.tasks.list(user.uid, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: TaskEntity })
  async get(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.get(user.uid, id);
  }

  @Post()
  @ApiOkResponse({ type: TaskEntity })
  async create(@AuthUser() user: any, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.uid, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TaskEntity })
  async update(@AuthUser() user: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user.uid, id, dto);
  }

  @Patch(':id/reorder')
  @ApiOkResponse({ type: TaskEntity })
  async reorder(@AuthUser() user: any, @Param('id') id: string, @Body() dto: ReorderTaskDto) {
    return this.tasks.reorder(user.uid, id, dto.order);
  }

  @Patch(':id/move')
  @ApiOkResponse({ type: TaskEntity })
  async move(@AuthUser() user: any, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasks.move(user.uid, id, dto);
  }

  @Patch(':id/complete')
  @ApiOkResponse({ type: TaskEntity })
  async complete(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.complete(user.uid, id);
  }

  @Patch(':id/uncomplete')
  @ApiOkResponse({ type: TaskEntity })
  async uncomplete(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.uncomplete(user.uid, id);
  }

  @Patch(':id/archive')
  @ApiOkResponse({ type: TaskEntity })
  async archive(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.archive(user.uid, id);
  }

  @Patch(':id/unarchive')
  @ApiOkResponse({ type: TaskEntity })
  async unarchive(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.unarchive(user.uid, id);
  }

  @Patch(':id/restore')
  @ApiOkResponse({ type: TaskEntity })
  async restore(@AuthUser() user: any, @Param('id') id: string) {
    return this.tasks.restore(user.uid, id);
  }

  @Post('bulk')
  async bulk(@AuthUser() user: any, @Body() dto: BulkTasksDto) {
    return this.tasks.bulk(user.uid, dto);
  }

  @Delete(':id')
  async remove(@AuthUser() user: any, @Param('id') id: string, @Query('soft') soft?: string) {
    const doSoft = soft === undefined ? true : String(soft).toLowerCase() !== 'false';
    await this.tasks.remove(user.uid, id, doSoft);
    return { ok: true };
  }
}
