import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { IdentityService } from './identity.service';

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: any = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    const cookieName = this.identity.getSessionCookieName();
    const cookieValue = req.cookies?.[cookieName] ?? req.signedCookies?.[cookieName];

    try {
      if (cookieValue) {
        const decoded = await this.identity.verifySessionCookie(cookieValue, true);
        req.user = decoded;
        return true;
      }
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice('Bearer '.length);
        const decoded = await this.identity.verifyIdToken(token, true);
        req.user = decoded;
        return true;
      }
    } catch (e) {
      throw new UnauthorizedException();
    }
    throw new UnauthorizedException();
  }
}
