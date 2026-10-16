import { describe, expect, jest, test } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import User from '../models/User.js'

describe('Protected user routes', () => {
  test('requires a token to access the current user', async () => {
    const response = await request(app).get('/api/users/me').expect(401)

    expect(response.body).toEqual({ message: 'Login first' })
  })

  test('rejects an invalid access token', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(403)
  })

  test('uses the authenticated user ID to fetch the current user', async () => {
    const user = { _id: '507f1f77bcf86cd799439011', email: 'admin@example.com', role: 'admin' }
    const findUser = jest.spyOn(User, 'find').mockResolvedValue([user])
    const token = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET_KEY, { expiresIn: '1h' })

    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body).toEqual([user])
    expect(findUser).toHaveBeenCalledWith({ _id: user._id })
  })
})

test('returns 404 for an unknown endpoint', async () => {
  await request(app).get('/api/does-not-exist').expect(404)
})
