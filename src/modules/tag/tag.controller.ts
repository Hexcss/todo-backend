import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdentityGuard } from 'src/shared/identity/identity.guard';
import { AuthUser } from 'src/shared/identity/auth-user.decorator';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagEntity } from './entities/tag.entity';
import { ReorderTagDto } from './dto/reorder-tag.dto';

@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('tags')
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get()
  @ApiOkResponse({ type: [TagEntity] })
  async list(@AuthUser() user: any) {
    return this.tags.list(user.uid);
  }

  @Get(':id')
  @ApiOkResponse({ type: TagEntity })
  async get(@AuthUser() user: any, @Param('id') id: string) {
    return this.tags.get(user.uid, id);
  }

  @Post()
  @ApiOkResponse({ type: TagEntity })
  async create(@AuthUser() user: any, @Body() dto: CreateTagDto) {
    return this.tags.create(user.uid, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TagEntity })
  async update(@AuthUser() user: any, @Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tags.update(user.uid, id, dto);
  }

  @Patch(':id/reorder')
  @ApiOkResponse({ type: TagEntity })
  async reorder(@AuthUser() user: any, @Param('id') id: string, @Body() dto: ReorderTagDto) {
    return this.tags.reorder(user.uid, id, dto.order);
  }

  @Delete(':id')
  async remove(@AuthUser() user: any, @Param('id') id: string, @Query('removeOnly') removeOnly?: string) {
    const only = removeOnly === undefined ? true : String(removeOnly).toLowerCase() !== 'false';
    await this.tags.remove(user.uid, id, only);
    return { ok: true };
  }
}
