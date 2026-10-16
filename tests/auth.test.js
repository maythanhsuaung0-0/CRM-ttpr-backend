import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import request from 'supertest'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import User from '../models/User.js'
import LoginCredentials from '../models/Login.js'

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

describe('POST /api/users/create', () => {
  test('hashes the password and creates an admin awaiting approval', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([])
    const createUser = jest.spyOn(User, 'create').mockImplementation(async (data) => {
      const user = new User(data)
      await user.validate()
      return user
    })

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(200)

    expect(response.body).toMatchObject({
      email: registration.email,
      role: 'admin',
      verified: false,
      locked: false
    })
    const storedPassword = createUser.mock.calls[0][0].password
    expect(storedPassword).not.toBe(password)
    expect(await argon2.verify(storedPassword, password)).toBe(true)
  })

  test('does not create another user for an existing email', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([admin()])
    const createUser = jest.spyOn(User, 'create')

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(201)

    expect(response.body.message).toContain('user already exists')
    expect(createUser).not.toHaveBeenCalled()
  })

  test('responds with an error when the database query fails', async () => {
    jest.spyOn(User, 'find').mockRejectedValue(new Error('Database unavailable'))

    const response = await request(app)
      .post('/api/users/create')
      .send(registration)
      .expect(400)

    expect(response.body).toEqual({ message: 'Database unavailable' })
  })
})

describe('POST /api/auth/login', () => {
  test('requires admin approval before login', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([admin({ verified: false })])

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password })
      .expect(403)

    expect(response.body.message).toContain('wait to be approved')
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  test('blocks a locked admin', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([admin({ locked: true })])

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password })
      .expect(403)

    expect(response.body).toEqual({ message: 'Login is Forbidden' })
  })

  test('rejects an incorrect password', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([admin()])

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: registration.email, password: 'IncorrectPassword!42' })
      .expect(401)

    expect(response.body).toEqual({ message: 'Your password is incorrect' })
  })

  test('logs in a verified admin and issues valid access and refresh tokens', async () => {
    const user = admin()
    jest.spyOn(User, 'find').mockResolvedValue([user])
    jest.spyOn(LoginCredentials, 'find').mockResolvedValue([])
    const createSession = jest.spyOn(LoginCredentials, 'create').mockResolvedValue({})
    jest.spyOn(console, 'log').mockImplementation(() => {})

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200)

    expect(response.body).toEqual({ message: { role: 'admin', is_first_login: true } })
    const accessCookie = response.headers['set-cookie'].find((cookie) => cookie.startsWith('access_token='))
    expect(accessCookie).toBeDefined()
    const accessToken = accessCookie.split(';')[0].slice('access_token='.length)
    expect(jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET_KEY).userId).toBe(user._id)

    const session = createSession.mock.calls[0][0]
    expect(session).toMatchObject({ user_id: user._id, email: user.email })
    expect(jwt.verify(session.refresh_token, process.env.REFRESH_TOKEN_SECRET_KEY).userId).toBe(user._id)
    expect(session.expired_at).toBeGreaterThan(session.created_at)
  })
})

test('GET /api/auth/logout clears the access cookie', async () => {
  const response = await request(app).get('/api/auth/logout').expect(200)

  expect(response.body).toEqual({ message: 'Logged out' })
  expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
    expect.stringMatching(/^access_token=;.*Expires=Thu, 01 Jan 1970/)
  ]))
})
