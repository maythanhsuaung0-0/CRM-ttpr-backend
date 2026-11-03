import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import request from 'supertest'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import User from '../models/User.js'
import LoginCredentials from '../models/Login.js'
import {
  generateTokenPair,
  hashRefreshToken,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  verifyAccessToken,
  verifyRefreshToken
} from '../utils/authSecurity.js'

const password = 'TestingAdmin!42'
let passwordHash

beforeAll(async () => {
  passwordHash = await argon2.hash(password)
})

const registration = {
  name: 'Test Admin',
  email: 'admin@example.com',
  id: '12345678',
  password,
  role: 'admin'
}

function admin(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    email: registration.email,
    password: passwordHash,
    role: 'admin',
    verified: true,
    locked: false,
    ...overrides
  }
}

function mockLoginLookup(user) {
  const select = jest.fn().mockResolvedValue(user)
  const findOne = jest.spyOn(User, 'findOne').mockReturnValue({ select })
  return { findOne, select }
}

describe('POST /api/users/create', () => {
  test('hashes the password and creates an admin awaiting approval', async () => {
    const findUser = jest.spyOn(User, 'findOne').mockResolvedValue(null)
    const createUser = jest.spyOn(User, 'create').mockImplementation(async (data) => {
      const user = new User(data)
      await user.validate()
      return user
    })

    const response = await request(app)
      .post('/api/users/create')
      .send({ ...registration, email: '  ADMIN@Example.COM  ', id: ' 12345678 ' })
      .expect(200)

    expect(response.body).toMatchObject({
      email: registration.email,
      role: 'admin',
      verified: false,
      locked: false
    })
    expect(response.body).not.toHaveProperty('password')
    expect(findUser).toHaveBeenCalledWith({
      $or: [{ email: registration.email }, { id: registration.id }]
    })
    expect(createUser.mock.calls[0][0]).toMatchObject({
      email: registration.email,
      id: registration.id
    })
    const storedPassword = createUser.mock.calls[0][0].password
    expect(storedPassword).not.toBe(password)
    expect(await argon2.verify(storedPassword, password)).toBe(true)
  })

  test('does not create another user for an existing email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(admin())
    const createUser = jest.spyOn(User, 'create')

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(409)

    expect(response.body).toEqual({
      message: 'An account with that email or institutional ID already exists'
    })
    expect(createUser).not.toHaveBeenCalled()
  })

  test('does not create another user for an existing institutional ID', async () => {
    const findUser = jest.spyOn(User, 'findOne').mockResolvedValue(admin({
      email: 'another@example.com',
      id: registration.id
    }))

    await request(app)
      .post('/api/users/create')
      .send({ ...registration, email: 'new@example.com' })
      .expect(409)

    expect(findUser).toHaveBeenCalledWith({
      $or: [{ email: 'new@example.com' }, { id: registration.id }]
    })
  })

  test('returns a safe conflict when the unique index wins a registration race', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null)
    const duplicateKeyError = Object.assign(new Error('duplicate key email admin@example.com'), {
      code: 11000,
      keyValue: { email: registration.email }
    })
    jest.spyOn(User, 'create').mockRejectedValue(duplicateKeyError)

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(409)

    expect(response.body).toEqual({
      message: 'A record with that unique value already exists'
    })
    expect(JSON.stringify(response.body)).not.toContain(registration.email)
  })

  test('responds with an error when the database query fails', async () => {
    jest.spyOn(User, 'findOne').mockRejectedValue(new Error('Database unavailable'))

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(500)

    expect(response.body).toEqual({ message: 'Database unavailable' })
  })
})

describe('POST /api/auth/login', () => {
  test('requires admin approval before login', async () => {
    mockLoginLookup(admin({ verified: false }))

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password })
      .expect(403)

    expect(response.body.message).toContain('wait to be approved')
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  test('blocks a locked admin', async () => {
    mockLoginLookup(admin({ locked: true }))

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password })
      .expect(403)

    expect(response.body).toEqual({ message: 'Login is Forbidden' })
  })

  test('rejects an incorrect password', async () => {
    mockLoginLookup(admin())

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password: 'IncorrectPassword!42' })
      .expect(401)

    expect(response.body).toEqual({ message: 'Invalid email or password' })
  })

  test('logs in a verified admin and issues valid access and refresh tokens', async () => {
    const user = admin()
    const { findOne, select } = mockLoginLookup(user)
    jest.spyOn(LoginCredentials, 'exists').mockResolvedValue(null)
    const deleteSessions = jest.spyOn(LoginCredentials, 'deleteMany').mockResolvedValue({ deletedCount: 0 })
    const createSession = jest.spyOn(LoginCredentials, 'create').mockResolvedValue({})

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ADMIN@Example.COM  ', password })
      .expect(200)

    expect(response.body).toEqual({ message: { role: 'admin', is_first_login: true } })
    expect(findOne).toHaveBeenCalledWith({ email: user.email })
    expect(select).toHaveBeenCalledWith('+password')
    expect(deleteSessions).toHaveBeenCalledWith({ user_id: user._id })

    const accessCookie = response.headers['set-cookie'].find((cookie) => cookie.startsWith('access_token='))
    const refreshCookie = response.headers['set-cookie'].find((cookie) => cookie.startsWith('refresh_token='))
    expect(accessCookie).toBeDefined()
    expect(refreshCookie).toBeDefined()
    expect(accessCookie).toEqual(expect.stringContaining('HttpOnly'))
    expect(accessCookie).toEqual(expect.stringContaining('SameSite=Lax'))
    expect(accessCookie).toEqual(expect.stringContaining('Max-Age=900'))
    expect(accessCookie).toEqual(expect.stringContaining('Path=/'))
    expect(refreshCookie).toEqual(expect.stringContaining('HttpOnly'))
    expect(refreshCookie).toEqual(expect.stringContaining('SameSite=Lax'))
    expect(refreshCookie).toEqual(expect.stringContaining('Max-Age=604800'))
    expect(refreshCookie).toEqual(expect.stringContaining('Path=/api'))

    const accessToken = accessCookie.split(';')[0].slice('access_token='.length)
    const refreshToken = refreshCookie.split(';')[0].slice('refresh_token='.length)
    const accessClaims = verifyAccessToken(accessToken)
    const refreshClaims = verifyRefreshToken(refreshToken)
    expect(accessClaims).toMatchObject({
      userId: user._id,
      sub: user._id,
      tokenType: 'access'
    })
    expect(refreshClaims).toMatchObject({
      userId: user._id,
      sub: user._id,
      tokenType: 'refresh'
    })
    expect(accessClaims.jti).toBe(refreshClaims.jti)

    const session = createSession.mock.calls[0][0]
    expect(session).toMatchObject({
      session_id: refreshClaims.jti,
      refresh_token_hash: hashRefreshToken(refreshToken),
      user_id: user._id,
      email: user.email,
      is_first_login: true
    })
    expect(session).not.toHaveProperty('refresh_token')
    expect(session.created_at).toBeInstanceOf(Date)
    expect(session.expired_at).toBeInstanceOf(Date)
    expect(session.expired_at.getTime()).toBeGreaterThan(session.created_at.getTime())
  })
})

describe('refresh sessions and logout', () => {
  test('stores only hidden token hashes and declares unique and expiry indexes', () => {
    expect(LoginCredentials.schema.path('refresh_token')).toBeUndefined()
    expect(LoginCredentials.schema.path('refresh_token_hash').options.select).toBe(false)

    const indexes = LoginCredentials.schema.indexes()
    expect(indexes).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        { session_id: 1 },
        expect.objectContaining({ unique: true, name: 'unique_refresh_session_id' })
      ]),
      expect.arrayContaining([
        { refresh_token_hash: 1 },
        expect.objectContaining({ unique: true, name: 'unique_refresh_token_hash' })
      ]),
      expect.arrayContaining([
        { expired_at: 1 },
        expect.objectContaining({ expireAfterSeconds: 0, name: 'expire_refresh_sessions' })
      ])
    ]))
  })

  test('atomically rotates a valid refresh session without accepting a user ID', async () => {
    const user = admin()
    const initialTokens = generateTokenPair({ userId: user._id })
    const rotateSession = jest.spyOn(LoginCredentials, 'findOneAndUpdate').mockResolvedValue({})

    const response = await request(app)
      .post('/api/refresh')
      .set('Cookie', `refresh_token=${initialTokens.refresh_token}`)
      .send({ userId: 'attacker-controlled-id' })
      .expect(200)

    expect(response.body).toEqual({ message: 'Refreshed successfully' })
    const [query, update, options] = rotateSession.mock.calls[0]
    expect(query).toMatchObject({
      session_id: initialTokens.sessionId,
      user_id: user._id,
      refresh_token_hash: hashRefreshToken(initialTokens.refresh_token)
    })
    expect(query.expired_at.$gt).toBeInstanceOf(Date)
    expect(update.$set.session_id).not.toBe(initialTokens.sessionId)
    expect(update.$set.refresh_token_hash).not.toBe(hashRefreshToken(initialTokens.refresh_token))
    expect(options).toEqual({ new: true, runValidators: true })
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^access_token=/),
      expect.stringMatching(/^refresh_token=/)
    ]))
  })

  test('rejects replay when the refresh session was already rotated', async () => {
    const tokens = generateTokenPair({ userId: admin()._id })
    jest.spyOn(LoginCredentials, 'findOneAndUpdate').mockResolvedValue(null)

    const response = await request(app)
      .post('/api/refresh')
      .set('Cookie', `refresh_token=${tokens.refresh_token}`)
      .expect(401)

    expect(response.body.message).toContain('already been used')
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^access_token=;/),
      expect.stringMatching(/^refresh_token=;/)
    ]))
  })

  test('rejects missing and malformed refresh cookies', async () => {
    const userId = admin()._id
    const expiredToken = jwt.sign(
      { userId, tokenType: 'refresh' },
      process.env.REFRESH_TOKEN_SECRET_KEY,
      {
        algorithm: 'HS256',
        audience: TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: userId,
        jwtid: 'expired-refresh-session',
        expiresIn: -1
      }
    )
    const missing = await request(app).post('/api/refresh').expect(401)
    const malformed = await request(app)
      .post('/api/refresh')
      .set('Cookie', 'refresh_token=not-a-jwt')
      .expect(401)
    const expired = await request(app)
      .post('/api/refresh')
      .set('Cookie', `refresh_token=${expiredToken}`)
      .expect(401)

    expect(missing.body).toEqual({ message: 'Refresh token required' })
    expect(malformed.body).toEqual({ message: 'Invalid refresh token' })
    expect(expired.body).toEqual({ message: 'Refresh token expired' })
  })

  test('revokes the presented refresh session and clears both cookies', async () => {
    const tokens = generateTokenPair({ userId: admin()._id })
    const deleteSession = jest.spyOn(LoginCredentials, 'deleteOne').mockResolvedValue({ deletedCount: 1 })
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refresh_token=${tokens.refresh_token}`)
      .expect(200)

    expect(response.body).toEqual({ message: 'Logged out' })
    expect(deleteSession).toHaveBeenCalledWith({
      refresh_token_hash: hashRefreshToken(tokens.refresh_token)
    })
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^access_token=;.*Expires=Thu, 01 Jan 1970/),
      expect.stringMatching(/^refresh_token=;.*Expires=Thu, 01 Jan 1970/)
    ]))
  })
})
