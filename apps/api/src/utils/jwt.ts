import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from './errors';

export type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  locale: string;
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.auth.secret, {
    expiresIn: config.auth.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.auth.secret) as TokenPayload;
  } catch {
    throw AppError.unauthenticated('Invalid or expired session');
  }
}

/** Best-effort verification used by optional-auth routes. */
export function tryVerifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, config.auth.secret) as TokenPayload;
  } catch {
    return null;
  }
}