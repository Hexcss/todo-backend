import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { FirestoreService } from 'src/shared/firestore/firestore.service';

@Injectable()
export class UserService {
  constructor(private readonly fs: FirestoreService) {}

  async getMe(uid: string): Promise<UserEntity | null> {
    return this.fs.getDoc<UserEntity>(this.fs.userDoc(uid));
  }

  async createMe(uid: string, dto: CreateUserDto): Promise<UserEntity | null> {
    await this.fs.setDoc(this.fs.userDoc(uid), {
      email: dto.email,
      name: dto.name ?? null,
      image: dto.image ?? null,
    });
    return this.getMe(uid);
  }

  async updateMe(uid: string, dto: UpdateUserDto): Promise<UserEntity | null> {
    await this.fs.updateDoc(this.fs.userDoc(uid), { ...dto });
    return this.getMe(uid);
  }

  async deleteMe(uid: string, soft = true): Promise<void> {
    await this.fs.cascadeDeleteUser(uid, soft);
  }
}
