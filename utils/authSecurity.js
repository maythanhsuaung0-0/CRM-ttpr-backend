import { createHash, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'

export const ACCESS_COOKIE_NAME = 'access_token'
export const REFRESH_COOKIE_NAME = 'refresh_token'
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
export const TOKEN_ISSUER = 'crm-ttpr'
export const TOKEN_AUDIENCE = 'crm-ttpr-api'

const jwtOptions = {
  algorithms: ['HS256'],
  issuer: TOKEN_ISSUER,
  audience: TOKEN_AUDIENCE
}

const secret = (name) => {
  const value = process.env[name]
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters`)
  }
  return value
}

export const generateTokenPair = ({ userId }, { sessionId = randomUUID() } = {}) => {
  const accessToken = jwt.sign(
    { userId: String(userId), tokenType: 'access' },
    secret('ACCESS_TOKEN_SECRET_KEY'),
    {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      subject: String(userId),
      jwtid: sessionId,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    }
  )
  const refreshToken = jwt.sign(
    { userId: String(userId), tokenType: 'refresh' },
    secret('REFRESH_TOKEN_SECRET_KEY'),
    {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      subject: String(userId),
      jwtid: sessionId,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS
    }
  )

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    sessionId,
    accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
  }
}

const verifyToken = (token, secretName, tokenType) => {
  const decoded = jwt.verify(token, secret(secretName), jwtOptions)
  if (
    decoded.tokenType !== tokenType ||
    !decoded.userId ||
    !decoded.jti ||
    decoded.sub !== String(decoded.userId)
  ) {
    throw new jwt.JsonWebTokenError(`Invalid ${tokenType} token claims`)
  }
  return decoded
}

export const verifyAccessToken = (token) => verifyToken(token, 'ACCESS_TOKEN_SECRET_KEY', 'access')
export const verifyRefreshToken = (token) => verifyToken(token, 'REFRESH_TOKEN_SECRET_KEY', 'refresh')

export const hashRefreshToken = (token) => createHash('sha256').update(token).digest('hex')

const sameSite = () => {
  const configured = process.env.COOKIE_SAME_SITE?.toLowerCase()
  return ['lax', 'strict', 'none'].includes(configured) ? configured : 'lax'
}

const cookieBase = (path) => {
  const configuredSameSite = sameSite()
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || configuredSameSite === 'none',
    sameSite: configuredSameSite,
    path
  }
}

export const setAuthCookies = (res, { access_token, refresh_token }) => {
  res.cookie(ACCESS_COOKIE_NAME, access_token, {
    ...cookieBase('/'),
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000
  })
  res.cookie(REFRESH_COOKIE_NAME, refresh_token, {
    ...cookieBase('/api'),
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000
  })
}

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieBase('/'))
  res.clearCookie(REFRESH_COOKIE_NAME, cookieBase('/api'))
}
