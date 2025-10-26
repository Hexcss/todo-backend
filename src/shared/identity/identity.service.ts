import { Injectable, OnModuleInit } from '@nestjs/common';
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
  private sessionCookieName: string;
  private sessionExpiresMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FIREBASE_API_KEY') ?? '';
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

  getSessionCookieName() {
    return this.sessionCookieName;
  }

  getSessionMaxAgeMs() {
    return this.sessionExpiresMs;
  }

  async signUpEmailPassword(email: string, password: string, displayName?: string) {
    const user = await this.auth.createUser({ email, password, displayName, emailVerified: false, disabled: false });
    return user;
  }

  async signInEmailPassword(email: string, password: string) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    if (!res.ok) throw new Error('auth/sign-in-failed');
    const data = (await res.json()) as SignInPasswordResponse;
    const sessionCookie = await this.auth.createSessionCookie(data.idToken, { expiresIn: this.sessionExpiresMs });
    const decoded = await this.verifySessionCookie(sessionCookie);
    return {
      uid: decoded.uid,
      email: decoded.email ?? email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      sessionCookie,
      expiresIn: this.sessionExpiresMs,
    };
  }

  async refreshIdToken(refreshToken: string) {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('auth/refresh-failed');
    const data = (await res.json()) as RefreshResponse;
    return { idToken: data.id_token, refreshToken: data.refresh_token, expiresIn: Number(data.expires_in) * 1000 };
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

  async updateUser(uid: string, data: Partial<Pick<admin.auth.UpdateRequest, 'displayName' | 'photoURL' | 'password' | 'email' | 'emailVerified' | 'disabled'>>) {
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
