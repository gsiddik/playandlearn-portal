import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import * as jwt from 'jsonwebtoken';

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, n: number) => Promise<Buffer>;
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET wajib di production');
  return s ?? 'dev-only-secret';
};

export interface AuthUser { sub: string; tenantId: string; role: string }

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `${salt.toString('hex')}:${h.toString('hex')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [s, h] = stored.split(':');
  const calc = await scrypt(pw, Buffer.from(s, 'hex'), 64);
  return timingSafeEqual(calc, Buffer.from(h, 'hex'));
}
export function issueTokens(u: AuthUser) {
  return {
    accessToken: jwt.sign({ ...u, typ: 'access' }, secret(), { expiresIn: '15m' }),
    refreshToken: jwt.sign({ ...u, typ: 'refresh' }, secret(), { expiresIn: '30d' }),
  };
}

/** Verifikasi token akses di luar konteks HTTP (mis. WebSocket). Mengembalikan null bila tidak valid. */
export function verifyAccess(token: string | null | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret()) as jwt.JwtPayload;
    return p.typ === 'access' ? { sub: p.sub as string, tenantId: p.tenantId, role: p.role } : null;
  } catch { return null; }
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const h: string | undefined = req.headers['authorization'];
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const p = jwt.verify(h.slice(7), secret()) as jwt.JwtPayload;
      if (p.typ !== 'access') throw new Error();
      req.user = { sub: p.sub, tenantId: p.tenantId, role: p.role } as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
