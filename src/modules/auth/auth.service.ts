import { Injectable } from '@nestjs/common';
import { IdentityService } from 'src/shared/identity/identity.service';
import { UserService } from '../user/user.service';
import { SignInDto } from 'src/shared/identity/dto/sign-in.dto';
import { SignUpDto } from 'src/shared/identity/dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(private readonly identity: IdentityService, private readonly users: UserService) {}

  async signUp(dto: SignUpDto) {
    const rec = await this.identity.signUpEmailPassword(dto.email, dto.password, dto.displayName);
    await this.users.createMe(rec.uid, { email: rec.email ?? dto.email, name: dto.displayName });
    return { uid: rec.uid, email: rec.email ?? dto.email };
  }

  async signIn(dto: SignInDto) {
    const session = await this.identity.signInEmailPassword(dto.email, dto.password);
    const me = await this.users.getMe(session.uid);
    if (!me) {
      await this.users.createMe(session.uid, { email: session.email });
    }
    return session;
  }

  async refresh(refreshToken: string) {
    const t = await this.identity.refreshIdToken(refreshToken);
    const sess = await this.identity.createSessionFromIdToken(t.idToken);
    return { idToken: t.idToken, refreshToken: t.refreshToken, sessionCookie: sess.sessionCookie, expiresIn: sess.expiresIn };
  }

  async signOut(uid: string) {
    await this.identity.revokeUserSessions(uid);
    return { ok: true };
  }
}
