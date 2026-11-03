import { describe, expect, jest, test } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import User from '../models/User.js'
import {
  generateTokenPair,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER
} from '../utils/authSecurity.js'

const accessTokenFor = (userId) => generateTokenPair({ userId }).access_token

describe('Protected user routes', () => {
  test('requires a token to access the current user', async () => {
    const response = await request(app).get('/api/users/me').expect(401)

    expect(response.body).toEqual({ message: 'Authentication required' })
  })

  test('rejects an invalid access token', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
  })

  test('rejects expired and wrong-purpose tokens with 401', async () => {
    const userId = '507f1f77bcf86cd799439011'
    const expiredToken = jwt.sign(
      { userId, tokenType: 'access' },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      {
        algorithm: 'HS256',
        audience: TOKEN_AUDIENCE,
        issuer: TOKEN_ISSUER,
        subject: userId,
        jwtid: 'expired-session',
        expiresIn: -1
      }
    )
    const refreshToken = generateTokenPair({ userId }).refresh_token

    const expired = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401)
    const wrongPurpose = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401)

    expect(expired.body).toEqual({ message: 'Access token expired' })
    expect(wrongPurpose.body).toEqual({ message: 'Invalid access token' })
  })

  test('uses the authenticated user ID to fetch the current user', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      password: 'argon2-hash-must-not-leak',
      role: 'admin'
    }
    const findUser = jest.spyOn(User, 'find').mockResolvedValue([user])
    const token = accessTokenFor(user._id)

    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body).toEqual([{
      _id: user._id,
      email: user.email,
      role: user.role
    }])
    expect(response.body[0]).not.toHaveProperty('password')
    expect(findUser).toHaveBeenCalledWith({ _id: user._id })
  })

  test('accepts the HttpOnly access cookie when no bearer header is present', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      role: 'admin'
    }
    jest.spyOn(User, 'find').mockResolvedValue([user])
    const token = accessTokenFor(user._id)

    const response = await request(app)
      .get('/api/users/me')
      .set('Cookie', `access_token=${token}`)
      .expect(200)

    expect(response.body[0]).toMatchObject(user)
  })

  test('never exposes password hashes from user list or detail endpoints', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      password: 'argon2-hash-must-not-leak',
      role: 'admin'
    }
    jest.spyOn(User, 'find').mockResolvedValue([user])
    const token = accessTokenFor(user._id)

    const listResponse = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const detailResponse = await request(app)
      .get(`/api/users/detail/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listResponse.body[0]).not.toHaveProperty('password')
    expect(detailResponse.body[0]).not.toHaveProperty('password')
  })

  test('ignores password fields in generic account updates and redacts the response', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Updated Admin',
      password: 'existing-argon2-hash',
      role: 'admin'
    }
    const updateUser = jest.spyOn(User, 'updateOne').mockResolvedValue({ acknowledged: true })
    jest.spyOn(User, 'find').mockResolvedValue([user])
    const token = accessTokenFor(user._id)

    const response = await request(app)
      .post('/api/users/update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        _id: user._id,
        data: { name: user.name, password: 'unhashed-replacement' }
      })
      .expect(200)

    expect(updateUser).toHaveBeenCalledWith(
      { _id: user._id },
      { $set: { name: user.name } },
      { runValidators: true }
    )
    expect(response.body[0]).not.toHaveProperty('password')
  })
})

test('returns 404 for an unknown endpoint', async () => {
  const response = await request(app).get('/api/does-not-exist').expect(404)

  expect(response.body).toEqual({
    message: 'Route GET /api/does-not-exist not found'
  })
})

describe('CORS allowlist', () => {
  test('allows configured browser origins with credentials', async () => {
    const response = await request(app)
      .get('/api/does-not-exist')
      .set('Origin', 'http://allowed.example')
      .expect(404)

    expect(response.headers['access-control-allow-origin']).toBe('http://allowed.example')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  test('rejects browser origins outside the allowlist', async () => {
    const response = await request(app)
      .get('/api/users/me')
      .set('Origin', 'https://untrusted.example')
      .expect(403)

    expect(response.body).toEqual({ message: 'Origin not allowed by CORS' })
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
