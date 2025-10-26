import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignInDto } from 'src/shared/identity/dto/sign-in.dto';
import { SignUpDto } from 'src/shared/identity/dto/sign-up.dto';
import { IdentityService } from 'src/shared/identity/identity.service';
import { IdentityGuard } from 'src/shared/identity/identity.guard';
import { AuthUser } from 'src/shared/identity/auth-user.decorator';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly identity: IdentityService) {}

  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Post('sign-in')
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.signIn(dto);
    res.cookie(this.identity.getSessionCookieName(), session.sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: this.identity.getSessionMaxAgeMs(),
      path: '/',
    });
    return { uid: session.uid, email: session.email, expiresIn: session.expiresIn };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.refresh(dto.refreshToken);
    res.cookie(this.identity.getSessionCookieName(), session.sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: this.identity.getSessionMaxAgeMs(),
      path: '/',
    });
    return { expiresIn: session.expiresIn };
  }

  @ApiBearerAuth()
  @UseGuards(IdentityGuard)
  @Post('sign-out')
  async signOut(@AuthUser() user: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.signOut(user.uid);
    res.clearCookie(this.identity.getSessionCookieName(), { path: '/' });
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(IdentityGuard)
  @Get('session')
  @ApiOkResponse({ type: Object })
  async session(@AuthUser() user: any) {
    return user;
  }
}
