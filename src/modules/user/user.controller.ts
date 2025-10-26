import { Body, Controller, Delete, Get, Put, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IdentityGuard } from 'src/shared/identity/identity.guard';
import { AuthUser } from 'src/shared/identity/auth-user.decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  @ApiOkResponse({ type: UserEntity })
  async me(@AuthUser() user: any) {
    return this.users.getMe(user.uid);
  }

  @Post('me')
  @ApiOkResponse({ type: UserEntity })
  async createMe(@AuthUser() user: any, @Body() dto: CreateUserDto) {
    return this.users.createMe(user.uid, dto);
  }

  @Put('me')
  @ApiOkResponse({ type: UserEntity })
  async updateMe(@AuthUser() user: any, @Body() dto: UpdateUserDto) {
    return this.users.updateMe(user.uid, dto);
  }

  @Delete('me')
  @ApiQuery({ name: 'soft', required: false, type: Boolean })
  async deleteMe(@AuthUser() user: any, @Query('soft') soft?: string) {
    const doSoft = soft === undefined ? true : String(soft).toLowerCase() !== 'false';
    await this.users.deleteMe(user.uid, doSoft);
    return { ok: true };
  }
}
