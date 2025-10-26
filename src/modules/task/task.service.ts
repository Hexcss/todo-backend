import { Injectable } from '@nestjs/common';
import { FirestoreService } from 'src/shared/firestore/firestore.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskEntity, TaskStatus, Priority } from './entities/task.entity';
import { ListTasksQueryDto } from './dto/list-tasks.query';
import { MoveTaskDto } from './dto/move-task.dto';
import { BulkTasksDto, BulkTaskAction } from './dto/bulk-tasks.dto';

@Injectable()
export class TaskService {
  constructor(private readonly fs: FirestoreService) {}

  private isOpen(t: Partial<TaskEntity>) {
    return t.status !== TaskStatus.DONE && !t.archivedAt && !t.deletedAt;
  }

  private async adjustProject(uid: string, projectId: string | null | undefined, deltaTask: number, deltaOpen: number) {
    if (!projectId) return;
    await this.fs.updateDoc(this.fs.projectDoc(uid, projectId), {
      taskCount: this.fs.increment(deltaTask),
      openCount: this.fs.increment(deltaOpen),
    });
  }

  private async adjustTags(uid: string, tagIds: string[], delta: number) {
    if (!tagIds?.length) return;
    await this.fs.runBatch(async (b) => {
      for (const tagId of tagIds) {
        b.set(this.fs.doc(this.fs.tagDoc(uid, tagId)), { usageCount: this.fs.increment(delta) }, { merge: true });
      }
    });
  }

  async list(uid: string, q: ListTasksQueryDto): Promise<TaskEntity[]> {
    const where: any[] = [];
    if (q.projectId !== undefined) where.push(['projectId', '==', q.projectId === '' ? null : q.projectId]);
    if (q.parentId !== undefined) where.push(['parentId', '==', q.parentId === '' ? null : q.parentId]);
    if (q.status) where.push(['status', '==', q.status]);
    if (q.priority) where.push(['priority', '==', q.priority]);
    if (q.archived === false) where.push(['archivedAt', '==', null]);
    if (q.archived === true) where.push(['archivedAt', '!=', null]);
    if (q.deleted === false) where.push(['deletedAt', '==', null]);
    if (q.deleted === true) where.push(['deletedAt', '!=', null]);
    if (q.tagIdsAny?.length) where.push(['tagIds', 'array-contains-any', q.tagIdsAny.slice(0, 10)]);
    if (q.dueAfter) where.push(['dueAt', '>=', q.dueAfter]);
    if (q.dueBefore) where.push(['dueAt', '<=', q.dueBefore]);

    const opts: any = {
      where,
      orderBy: [['order', 'asc'], ['createdAt', 'asc']],
      limit: Math.min(Math.max(q.limit ?? 50, 1), 100),
    };

    if (q.startAfterId) {
      const snap = await this.fs.doc(this.fs.taskDoc(uid, q.startAfterId)).get();
      if (snap.exists) opts.startAfter = snap;
    }

    return this.fs.find<TaskEntity>(this.fs.tasksCol(uid), opts);
  }

  async get(uid: string, id: string): Promise<TaskEntity | null> {
    return this.fs.getDoc<TaskEntity>(this.fs.taskDoc(uid, id));
  }

  async create(uid: string, dto: CreateTaskDto): Promise<TaskEntity | null> {
    const data: Partial<TaskEntity> = {
      title: dto.title,
      description: dto.description ?? "",
      status: dto.status ?? TaskStatus.TODO,
      priority: dto.priority ?? Priority.MEDIUM,
      projectId: dto.projectId ?? null,
      parentId: dto.parentId ?? null,
      tagIds: dto.tagIds ?? [],
      order: dto.order ?? 0,
      dueAt: dto.dueAt ?? null,
      remindAt: dto.remindAt ?? null,
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
      url: dto.url ?? null,
    };

    const id = await this.fs.upsert(this.fs.tasksCol(uid), data as any, {});
    const created = await this.get(uid, id);

    if (created) {
      await this.adjustProject(uid, created.projectId ?? null, 1, this.isOpen(created) ? 1 : 0);
      await this.adjustTags(uid, created.tagIds ?? [], 1);
    }

    return created;
  }

  async update(uid: string, id: string, dto: UpdateTaskDto): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;

    const next: Partial<TaskEntity> = { ...current, ...dto };

    if (dto.status && dto.status === TaskStatus.DONE && current.completedAt == null && dto.completedAt === undefined) {
      next.completedAt = new Date();
    }
    if (dto.status && current.status === TaskStatus.DONE && dto.status !== TaskStatus.DONE && dto.completedAt === undefined) {
      next.completedAt = null;
    }

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), next as any);

    const updated = await this.get(uid, id);
    if (!updated) return null;

    if (current.projectId !== updated.projectId || this.isOpen(current) !== this.isOpen(updated)) {
      await this.adjustProject(uid, current.projectId ?? null, 0 - (current.deletedAt ? 0 : 0), this.isOpen(current) ? -1 : 0);
      await this.adjustProject(uid, updated.projectId ?? null, 0 - (updated.deletedAt ? 0 : 0), this.isOpen(updated) ? +1 : 0);

      if (!current.deletedAt && current.projectId && current.projectId !== updated.projectId) {
        await this.adjustProject(uid, current.projectId, -1, 0);
      }
      if (!updated.deletedAt && updated.projectId && current.projectId !== updated.projectId) {
        await this.adjustProject(uid, updated.projectId, +1, 0);
      }

      if (!current.deletedAt && current.projectId === updated.projectId) {
        const deltaOpen = (this.isOpen(updated) ? 1 : 0) - (this.isOpen(current) ? 1 : 0);
        if (deltaOpen !== 0) await this.adjustProject(uid, updated.projectId ?? null, 0, deltaOpen);
      }
    }

    const beforeTags = new Set(current.tagIds ?? []);
    const afterTags = new Set(updated.tagIds ?? []);
    const added: string[] = [];
    const removed: string[] = [];
    for (const t of afterTags) if (!beforeTags.has(t)) added.push(t);
    for (const t of beforeTags) if (!afterTags.has(t)) removed.push(t);
    if (added.length) await this.adjustTags(uid, added, 1);
    if (removed.length) await this.adjustTags(uid, removed, -1);

    return updated;
  }

  async reorder(uid: string, id: string, order: number): Promise<TaskEntity | null> {
    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { order });
    return this.get(uid, id);
  }

  async move(uid: string, id: string, dto: MoveTaskDto): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;

    const nextProjectId = dto.projectId ?? current.projectId ?? null;
    const nextParentId = dto.parentId === undefined ? current.parentId ?? null : dto.parentId;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), {
      projectId: nextProjectId,
      parentId: nextParentId,
      order: dto.order ?? current.order,
    });

    const updated = await this.get(uid, id);
    if (!updated) return null;

    if (!current.deletedAt && current.projectId !== updated.projectId) {
      await this.adjustProject(uid, current.projectId ?? null, -1, this.isOpen(current) ? -1 : 0);
      await this.adjustProject(uid, updated.projectId ?? null, +1, this.isOpen(updated) ? +1 : 0);
    }

    return updated;
  }

  async complete(uid: string, id: string): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;
    if (current.status === TaskStatus.DONE && current.completedAt) return current;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { status: TaskStatus.DONE, completedAt: new Date() });

    const updated = await this.get(uid, id);
    if (updated && this.isOpen(current) && !this.isOpen(updated)) {
      await this.adjustProject(uid, updated.projectId ?? null, 0, -1);
    }
    return updated;
    }

  async uncomplete(uid: string, id: string): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { status: TaskStatus.TODO, completedAt: null });

    const updated = await this.get(uid, id);
    if (updated && !this.isOpen(current) && this.isOpen(updated)) {
      await this.adjustProject(uid, updated.projectId ?? null, 0, +1);
    }
    return updated;
  }

  async archive(uid: string, id: string): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { archivedAt: new Date() });

    const updated = await this.get(uid, id);
    if (updated && this.isOpen(current) && !this.isOpen(updated)) {
      await this.adjustProject(uid, updated.projectId ?? null, 0, -1);
    }
    return updated;
  }

  async unarchive(uid: string, id: string): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { archivedAt: null });

    const updated = await this.get(uid, id);
    if (updated && !this.isOpen(current) && this.isOpen(updated)) {
      await this.adjustProject(uid, updated.projectId ?? null, 0, +1);
    }
    return updated;
  }

  async restore(uid: string, id: string): Promise<TaskEntity | null> {
    const current = await this.get(uid, id);
    if (!current) return null;
    if (!current.deletedAt) return current;

    await this.fs.updateDoc(this.fs.taskDoc(uid, id), { deletedAt: null });

    const updated = await this.get(uid, id);
    if (updated) {
      await this.adjustProject(uid, updated.projectId ?? null, +1, this.isOpen(updated) ? +1 : 0);
    }
    return updated;
  }

  async remove(uid: string, id: string, soft = true): Promise<void> {
    const current = await this.get(uid, id);
    if (!current) return;

    if (soft) {
      if (!current.deletedAt) {
        await this.fs.updateDoc(this.fs.taskDoc(uid, id), { deletedAt: new Date() });
        await this.adjustProject(uid, current.projectId ?? null, -1, this.isOpen(current) ? -1 : 0);
        await this.adjustTags(uid, current.tagIds ?? [], -1);
      }
    } else {
      await this.fs.deleteDoc(this.fs.taskDoc(uid, id));
      if (!current.deletedAt) {
        await this.adjustProject(uid, current.projectId ?? null, -1, this.isOpen(current) ? -1 : 0);
        await this.adjustTags(uid, current.tagIds ?? [], -1);
      }
    }
  }

  async bulk(uid: string, dto: BulkTasksDto) {
    const results: any[] = [];
    for (const action of dto.actions) {
      const op = action.op as BulkTaskAction['op'];
      if (op === 'create') {
        results.push(await this.create(uid, action.data as CreateTaskDto));
      } else if (op === 'update') {
        results.push(await this.update(uid, action.id as string, action.data as UpdateTaskDto));
      } else if (op === 'delete') {
        await this.remove(uid, action.id as string, false);
        results.push({ id: action.id, ok: true });
      } else if (op === 'softDelete') {
        await this.remove(uid, action.id as string, true);
        results.push({ id: action.id, ok: true });
      } else if (op === 'restore') {
        results.push(await this.restore(uid, action.id as string));
      } else if (op === 'move') {
        results.push(await this.move(uid, action.id as string, { projectId: action.projectId ?? null, parentId: action.parentId ?? null, order: action.order }));
      } else if (op === 'reorder') {
        results.push(await this.reorder(uid, action.id as string, action.order as number));
      } else if (op === 'archive') {
        results.push(await this.archive(uid, action.id as string));
      } else if (op === 'unarchive') {
        results.push(await this.unarchive(uid, action.id as string));
      } else if (op === 'complete') {
        results.push(await this.complete(uid, action.id as string));
      } else if (op === 'uncomplete') {
        results.push(await this.uncomplete(uid, action.id as string));
      }
    }
    return { results };
  }
}
