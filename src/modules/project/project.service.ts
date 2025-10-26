import { Injectable } from '@nestjs/common';
import { FirestoreService } from 'src/shared/firestore/firestore.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectEntity } from './entities/project.entity';

@Injectable()
export class ProjectService {
  constructor(private readonly fs: FirestoreService) {}

  async list(uid: string): Promise<ProjectEntity[]> {
    return this.fs.find<ProjectEntity>(this.fs.projectsCol(uid), {
      orderBy: [['order', 'asc'], ['createdAt', 'asc']],
    });
  }

  async get(uid: string, id: string): Promise<ProjectEntity | null> {
    return this.fs.getDoc<ProjectEntity>(this.fs.projectDoc(uid, id));
  }

  async create(uid: string, dto: CreateProjectDto): Promise<ProjectEntity | null> {
    const data = {
      name: dto.name,
      color: dto.color ?? null,
      order: dto.order ?? 0,
      taskCount: 0,
      openCount: 0,
    };
    const id = await this.fs.upsert(this.fs.projectsCol(uid), data, {});
    return this.get(uid, id);
  }

  async update(uid: string, id: string, dto: UpdateProjectDto): Promise<ProjectEntity | null> {
    await this.fs.updateDoc(this.fs.projectDoc(uid, id), { ...dto });
    return this.get(uid, id);
  }

  async reorder(uid: string, id: string, order: number): Promise<ProjectEntity | null> {
    await this.fs.updateDoc(this.fs.projectDoc(uid, id), { order });
    return this.get(uid, id);
  }

  async remove(uid: string, id: string, soft = true): Promise<void> {
    await this.fs.cascadeDeleteProject(uid, id, soft);
  }
}
