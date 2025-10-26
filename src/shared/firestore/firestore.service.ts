import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';
import { QueryOptions, UpsertOptions, WhereTuple } from 'src/common/types/firestore.types';

@Injectable()
export class FirestoreService implements OnModuleInit {
  private app: admin.app.App;
  private db: FirebaseFirestore.Firestore;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')!;
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL')!;
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')!;
    const databaseId = this.config.get<string>('FIRESTORE_DATABASE_ID')!;

    if (admin.apps.length === 0) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      this.app = admin.app();
    }

    this.db = new Firestore({
      projectId,
      databaseId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    }) as unknown as FirebaseFirestore.Firestore;

    this.db.settings({ ignoreUndefinedProperties: true });
  }

  serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  arrayUnion(...values: unknown[]) {
    return admin.firestore.FieldValue.arrayUnion(...values);
  }

  arrayRemove(...values: unknown[]) {
    return admin.firestore.FieldValue.arrayRemove(...values);
  }

  increment(n: number) {
    return admin.firestore.FieldValue.increment(n);
  }

  doc(path: string) {
    return this.db.doc(path);
  }

  col(path: string) {
    return this.db.collection(path);
  }

  async getDoc<T = FirebaseFirestore.DocumentData>(path: string) {
    const snap = await this.doc(path).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as T) } as T & { id: string };
  }

  async setDoc(path: string, data: Record<string, unknown>, merge = true) {
    const now = this.serverTimestamp();
    const base = { updatedAt: now, createdAt: now };
    await this.doc(path).set({ ...base, ...data }, { merge });
  }

  async updateDoc(path: string, data: Record<string, unknown>) {
    const now = this.serverTimestamp();
    await this.doc(path).set({ ...data, updatedAt: now }, { merge: true });
  }

  async upsert<T extends Record<string, unknown>>(collectionPath: string, data: T, options: UpsertOptions = {}) {
    const id = options.id || this.col(collectionPath).doc().id;
    const now = this.serverTimestamp();
    await this.doc(`${collectionPath}/${id}`).set({ ...data, createdAt: now, updatedAt: now }, { merge: options.merge ?? true });
    return id;
  }

  async deleteDoc(path: string) {
    await this.doc(path).delete();
  }

  async softDelete(path: string) {
    await this.updateDoc(path, { deletedAt: new Date() });
  }

  async restore(path: string) {
    await this.updateDoc(path, { deletedAt: null });
  }

  async find<T = FirebaseFirestore.DocumentData>(collectionPath: string, opts: QueryOptions = {}) {
    let q: FirebaseFirestore.Query = this.col(collectionPath);
    if (opts.select?.length) q = (q as FirebaseFirestore.Query).select(...opts.select);
    if (opts.where?.length) {
      for (const [f, op, v] of opts.where) q = q.where(f, op, v);
    }
    if (opts.orderBy?.length) {
      for (const [f, dir] of opts.orderBy) q = q.orderBy(f, dir);
    }
    if (opts.startAfter !== undefined) q = q.startAfter(opts.startAfter);
    if (opts.limit) q = q.limit(opts.limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
  }

  async count(collectionPath: string, opts: QueryOptions = {}) {
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData> = this.col(collectionPath);
    if (opts.where?.length) for (const [f, op, v] of opts.where) q = q.where(f, op, v);
    const aggSnap = await q.count().get();
    return aggSnap.data().count;
  }

  async runTransaction<T>(fn: (tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore) => Promise<T>) {
    return (this.db as any).runTransaction(async (tx: FirebaseFirestore.Transaction) => fn(tx, this.db));
  }

  async runBatch(fn: (batch: FirebaseFirestore.WriteBatch, db: FirebaseFirestore.Firestore) => Promise<void>) {
    const batch = (this.db as any).batch() as FirebaseFirestore.WriteBatch;
    await fn(batch, this.db);
    await batch.commit();
  }

  async bulkDelete(paths: string[], chunkSize = 500) {
    for (let i = 0; i < paths.length; i += chunkSize) {
      const slice = paths.slice(i, i + chunkSize);
      await this.runBatch(async b => {
        for (const p of slice) b.delete(this.doc(p));
      });
    }
  }

  async bulkSoftDelete(paths: string[], chunkSize = 500) {
    for (let i = 0; i < paths.length; i += chunkSize) {
      const slice = paths.slice(i, i + chunkSize);
      await this.runBatch(async b => {
        for (const p of slice) b.set(this.doc(p), { deletedAt: new Date(), updatedAt: this.serverTimestamp() }, { merge: true });
      });
    }
  }

  async bulkUpdate(updates: { path: string; data: Record<string, unknown> }[], chunkSize = 500) {
    for (let i = 0; i < updates.length; i += chunkSize) {
      const slice = updates.slice(i, i + chunkSize);
      await this.runBatch(async b => {
        for (const u of slice) b.set(this.doc(u.path), { ...u.data, updatedAt: this.serverTimestamp() }, { merge: true });
      });
    }
  }

  async bulkCreate(collectionPath: string, rows: Record<string, unknown>[], chunkSize = 500) {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      await this.runBatch(async b => {
        for (const r of slice) {
          const ref = this.col(collectionPath).doc();
          b.set(ref, { ...r, createdAt: this.serverTimestamp(), updatedAt: this.serverTimestamp() });
        }
      });
    }
  }

  async deleteCollection(collectionPath: string, batchSize = 500) {
    while (true) {
      const snap = await this.col(collectionPath).limit(batchSize).get();
      if (snap.empty) break;
      await this.runBatch(async b => {
        for (const d of snap.docs) b.delete(d.ref);
      });
    }
  }

  async deleteByQuery(collectionPath: string, where: WhereTuple[], batchSize = 500) {
    let cursor: unknown | undefined = undefined;
    while (true) {
      let q: FirebaseFirestore.Query = this.col(collectionPath);
      for (const [f, op, v] of where) q = q.where(f, op, v);
      q = q.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;
      await this.runBatch(async b => {
        for (const d of snap.docs) b.delete(d.ref);
      });
      cursor = snap.docs[snap.docs.length - 1].id;
    }
  }

  userDoc(uid: string) {
    return `users/${uid}`;
  }

  projectsCol(uid: string) {
    return `users/${uid}/projects`;
  }

  tagsCol(uid: string) {
    return `users/${uid}/tags`;
  }

  tasksCol(uid: string) {
    return `users/${uid}/tasks`;
  }

  projectDoc(uid: string, projectId: string) {
    return `${this.projectsCol(uid)}/${projectId}`;
  }

  tagDoc(uid: string, tagId: string) {
    return `${this.tagsCol(uid)}/${tagId}`;
  }

  taskDoc(uid: string, taskId: string) {
    return `${this.tasksCol(uid)}/${taskId}`;
  }

  async cascadeDeleteUser(uid: string, soft = false) {
    const roots = [this.projectsCol(uid), this.tagsCol(uid), this.tasksCol(uid)];
    if (soft) {
      for (const col of roots) {
        while (true) {
          const snap = await this.col(col).limit(500).get();
          if (snap.empty) break;
          await this.runBatch(async b => {
            for (const d of snap.docs) b.set(d.ref, { deletedAt: new Date(), updatedAt: this.serverTimestamp() }, { merge: true });
          });
        }
      }
      await this.updateDoc(this.userDoc(uid), { deletedAt: new Date() });
      return;
    }
    for (const col of roots) await this.deleteCollection(col, 500);
    await this.deleteDoc(this.userDoc(uid));
  }

  async cascadeDeleteProject(uid: string, projectId: string, soft = false) {
    const tasks = await this.find<{ id: string }>(this.tasksCol(uid), { where: [['projectId', '==', projectId]] });
    const taskPaths = tasks.map(t => this.taskDoc(uid, t.id));
    if (soft) {
      await this.bulkSoftDelete(taskPaths);
      await this.softDelete(this.projectDoc(uid, projectId));
    } else {
      await this.bulkDelete(taskPaths);
      await this.deleteDoc(this.projectDoc(uid, projectId));
    }
  }

  async cascadeDeleteTask(uid: string, taskId: string, soft = false) {
    const toDelete: string[] = [];
    const queue: string[] = [taskId];
    while (queue.length) {
      const current = queue.shift() as string;
      toDelete.push(this.taskDoc(uid, current));
      const children = await this.find<{ id: string }>(this.tasksCol(uid), { where: [['parentId', '==', current]], limit: 500 });
      for (const c of children) queue.push(c.id);
    }
    if (soft) {
      await this.bulkSoftDelete(toDelete);
    } else {
      await this.bulkDelete(toDelete);
    }
  }

  async cascadeDeleteTag(uid: string, tagId: string, removeOnly = true) {
    let cursor: unknown | undefined = undefined;
    while (true) {
      let q: FirebaseFirestore.Query = this.col(this.tasksCol(uid)).where('tagIds', 'array-contains', tagId).orderBy(admin.firestore.FieldPath.documentId()).limit(500);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;
      await this.runBatch(async b => {
        for (const d of snap.docs) {
          const ref = d.ref;
          if (removeOnly) {
            b.update(ref, { tagIds: this.arrayRemove(tagId), updatedAt: this.serverTimestamp() });
          } else {
            b.delete(ref);
          }
        }
      });
      cursor = snap.docs[snap.docs.length - 1].id;
    }
    await this.deleteDoc(this.tagDoc(uid, tagId));
  }
}
