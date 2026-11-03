import { describe, expect, test } from '@jest/globals'
import User from '../models/User.js'
import { toPublicUser, toPublicUsers } from '../utils/userSerialization.js'

const userData = {
  name: 'Test Admin',
  email: '  ADMIN@Example.COM  ',
  id: ' 12345678 ',
  password: 'argon2-hash',
  role: 'admin'
}

describe('User credential protection', () => {
  test('hides passwords by default and when serializing a new document', async () => {
    const user = new User(userData)
    await user.validate()

    expect(User.schema.path('password').options.select).toBe(false)
    expect(user.toJSON()).not.toHaveProperty('password')
    expect(user.toObject()).not.toHaveProperty('password')
  })

  test('normalizes email and institutional ID before persistence', async () => {
    const user = new User(userData)
    await user.validate()

    expect(user.email).toBe('admin@example.com')
    expect(user.id).toBe('12345678')
  })

  test('defines unique indexes for case-insensitive email and institutional ID', () => {
    const indexes = User.schema.indexes()
    const emailIndex = indexes.find(([fields]) => fields.email === 1)
    const idIndex = indexes.find(([fields]) => fields.id === 1)

    expect(emailIndex?.[1]).toMatchObject({
      unique: true,
      name: 'unique_user_email',
      collation: { locale: 'en', strength: 2 }
    })
    expect(idIndex?.[1]).toMatchObject({
      unique: true,
      name: 'unique_user_id'
    })
  })

  test('removes password hashes from plain objects and arrays', () => {
    const user = { email: 'admin@example.com', password: 'argon2-hash', role: 'admin' }

    expect(toPublicUser(user)).toEqual({ email: user.email, role: user.role })
    expect(toPublicUsers([user])).toEqual([{ email: user.email, role: user.role }])
    expect(user.password).toBe('argon2-hash')
  })
})
