import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IdentityGuard } from 'src/shared/identity/identity.guard';
import { AuthUser } from 'src/shared/identity/auth-user.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectEntity } from './entities/project.entity';
import { ReorderProjectDto } from './dto/reorder-project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get()
  @ApiOkResponse({ type: [ProjectEntity] })
  async list(@AuthUser() user: any) {
    return this.projects.list(user.uid);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProjectEntity })
  async get(@AuthUser() user: any, @Param('id') id: string) {
    return this.projects.get(user.uid, id);
  }

  @Post()
  @ApiOkResponse({ type: ProjectEntity })
  async create(@AuthUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.uid, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectEntity })
  async update(@AuthUser() user: any, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(user.uid, id, dto);
  }

  @Patch(':id/reorder')
  @ApiOkResponse({ type: ProjectEntity })
  async reorder(@AuthUser() user: any, @Param('id') id: string, @Body() dto: ReorderProjectDto) {
    return this.projects.reorder(user.uid, id, dto.order);
  }

  @Delete(':id')
  async remove(@AuthUser() user: any, @Param('id') id: string, @Query('soft') soft?: string) {
    const doSoft = soft === undefined ? true : String(soft).toLowerCase() !== 'false';
    await this.projects.remove(user.uid, id, doSoft);
    return { ok: true };
  }
}
