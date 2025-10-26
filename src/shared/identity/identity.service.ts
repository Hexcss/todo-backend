import { Injectable, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

type SignInPasswordResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email: string;
  registered: boolean;
};

type RefreshResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: string;
  user_id: string;
  project_id: string;
};

@Injectable()
export class IdentityService implements OnModuleInit {
  private app: admin.app.App;
  private auth: admin.auth.Auth;
  private apiKey: string;
  private projectId: string;
  private sessionCookieName: string;
  private sessionExpiresMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FIREBASE_API_KEY') ?? '';
    this.projectId = this.config.get<string>('FIREBASE_PROJECT_ID') ?? '';
    this.sessionCookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? '__session';
    const days = Number(this.config.get<string>('SESSION_EXPIRES_DAYS') ?? '14');
    this.sessionExpiresMs = Math.max(1, days) * 24 * 60 * 60 * 1000;
  }

  onModuleInit() {
    if (admin.apps.length === 0) {
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
      if (projectId && clientEmail && privateKey) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      } else {
        this.app = admin.initializeApp();
      }
    } else {
      this.app = admin.app();
    }
    this.auth = admin.auth();
  }

  private mapIdentityRestToHttp(msg: string): number {
    switch (msg) {
      case 'EMAIL_EXISTS':
        return HttpStatus.CONFLICT;
      case 'OPERATION_NOT_ALLOWED':
      case 'USER_DISABLED':
        return HttpStatus.FORBIDDEN;
      case 'EMAIL_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'INVALID_PASSWORD':
      case 'WEAK_PASSWORD':
      case 'MISSING_PASSWORD':
      case 'INVALID_EMAIL':
        return HttpStatus.BAD_REQUEST;
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return HttpStatus.TOO_MANY_REQUESTS;
      case 'INVALID_REFRESH_TOKEN':
      case 'TOKEN_EXPIRED':
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }

  getSessionCookieName() {
    return this.sessionCookieName;
  }

  getSessionMaxAgeMs() {
    return this.sessionExpiresMs;
  }

  async signUpEmailPassword(email: string, password: string, displayName?: string) {
    try {
      const user = await this.auth.createUser({ email, password, displayName, emailVerified: false, disabled: false });
      return user;
    } catch (e: any) {
      const code: string = e?.code || 'auth/unknown';
      const msg: string = e?.message || 'Sign up failed';
      let status = HttpStatus.BAD_REQUEST;
      if (code === 'auth/email-already-exists' || code === 'auth/uid-already-exists') status = HttpStatus.CONFLICT;
      else if (code === 'auth/operation-not-allowed' || code === 'auth/insufficient-permission') status = HttpStatus.FORBIDDEN;
      throw new HttpException(msg, status);
    }
  }

  async signInEmailPassword(email: string, password: string) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.apiKey}`;
    const body: Record<string, any> = { email, password, returnSecureToken: true };
    if (this.projectId) body.targetProjectId = this.projectId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as
      | SignInPasswordResponse
      | { error?: { code?: number; message?: string } };

    if (!res.ok) {
      const msg = (data as any)?.error?.message || 'UNKNOWN_ERROR';
      const status = this.mapIdentityRestToHttp(msg);
      throw new HttpException(msg, status);
    }

    const ok = data as SignInPasswordResponse;
    const sessionCookie = await this.auth.createSessionCookie(ok.idToken, { expiresIn: this.sessionExpiresMs });
    const decoded = await this.verifySessionCookie(sessionCookie);
    return {
      uid: decoded.uid,
      email: decoded.email ?? email,
      idToken: ok.idToken,
      refreshToken: ok.refreshToken,
      sessionCookie,
      expiresIn: this.sessionExpiresMs,
    };
  }

  async refreshIdToken(refreshToken: string) {
    const url = `https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });

    const data = (await res.json().catch(() => ({}))) as
      | RefreshResponse
      | { error?: { message?: string } };

    if (!res.ok) {
      const msg = (data as any)?.error?.message || 'UNKNOWN_ERROR';
      const status = this.mapIdentityRestToHttp(msg);
      throw new HttpException(msg, status);
    }

    return {
      idToken: (data as RefreshResponse).id_token,
      refreshToken: (data as RefreshResponse).refresh_token,
      expiresIn: Number((data as RefreshResponse).expires_in) * 1000,
    };
  }

  async verifyIdToken(idToken: string, checkRevoked = true) {
    const decoded = await this.auth.verifyIdToken(idToken, checkRevoked);
    return decoded;
  }

  async verifySessionCookie(cookie: string, checkRevoked = true) {
    const decoded = await this.auth.verifySessionCookie(cookie, checkRevoked);
    return decoded;
  }

  async createSessionFromIdToken(idToken: string) {
    const sessionCookie = await this.auth.createSessionCookie(idToken, { expiresIn: this.sessionExpiresMs });
    const decoded = await this.verifySessionCookie(sessionCookie);
    return { sessionCookie, decoded, expiresIn: this.sessionExpiresMs };
  }

  async revokeUserSessions(uid: string) {
    await this.auth.revokeRefreshTokens(uid);
    return true;
  }

  async getUser(uid: string) {
    return this.auth.getUser(uid);
  }

  async getUserByEmail(email: string) {
    return this.auth.getUserByEmail(email);
  }

  async updateUser(
    uid: string,
    data: Partial<
      Pick<admin.auth.UpdateRequest, 'displayName' | 'photoURL' | 'password' | 'email' | 'emailVerified' | 'disabled'>
    >,
  ) {
    return this.auth.updateUser(uid, data);
  }

  async deleteUser(uid: string) {
    await this.auth.deleteUser(uid);
    return true;
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown>) {
    await this.auth.setCustomUserClaims(uid, claims);
    return true;
  }
}
