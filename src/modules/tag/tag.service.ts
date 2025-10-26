import { Injectable } from '@nestjs/common';
import { FirestoreService } from 'src/shared/firestore/firestore.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagEntity } from './entities/tag.entity';

@Injectable()
export class TagService {
  constructor(private readonly fs: FirestoreService) {}

  async list(uid: string): Promise<TagEntity[]> {
    return this.fs.find<TagEntity>(this.fs.tagsCol(uid), {
      orderBy: [['order', 'asc'], ['createdAt', 'asc']],
    });
  }

  async get(uid: string, id: string): Promise<TagEntity | null> {
    return this.fs.getDoc<TagEntity>(this.fs.tagDoc(uid, id));
  }

  async create(uid: string, dto: CreateTagDto): Promise<TagEntity | null> {
    const data = {
      name: dto.name,
      color: dto.color ?? null,
      order: dto.order ?? 0,
      usageCount: 0,
    };
    const id = await this.fs.upsert(this.fs.tagsCol(uid), data, {});
    return this.get(uid, id);
  }

  async update(uid: string, id: string, dto: UpdateTagDto): Promise<TagEntity | null> {
    await this.fs.updateDoc(this.fs.tagDoc(uid, id), { ...dto });
    return this.get(uid, id);
  }

  async reorder(uid: string, id: string, order: number): Promise<TagEntity | null> {
    await this.fs.updateDoc(this.fs.tagDoc(uid, id), { order });
    return this.get(uid, id);
  }

  async remove(uid: string, id: string, removeOnly = true): Promise<void> {
    await this.fs.cascadeDeleteTag(uid, id, removeOnly);
  }
}
