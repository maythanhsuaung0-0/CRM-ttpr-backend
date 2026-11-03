import { describe, expect, test } from '@jest/globals'
import request from 'supertest'
import app, { routeMounts } from '../app.js'

const joinRoute = (basePath, routePath) => {
  if (routePath === '/') {
    return basePath
  }
  return `${basePath}${routePath}`
}

const registeredEndpoints = () => routeMounts.flatMap(({ path, router }) => (
  router.stack.flatMap((layer) => {
    if (!layer.route) {
      return []
    }

    return Object.keys(layer.route.methods)
      .filter((method) => layer.route.methods[method])
      .map((method) => `${method.toUpperCase()} ${joinRoute(path, layer.route.path)}`)
  })
))

describe('canonical route registry', () => {
  test('registers each mount path exactly once', () => {
    const paths = routeMounts.map(({ path }) => path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toContain('/api/major')
    expect(paths).not.toContain('/api/,major')
  })

  test('contains no duplicate method and path pairs', () => {
    const endpoints = registeredEndpoints()
    const duplicates = endpoints.filter((endpoint, index) => endpoints.indexOf(endpoint) !== index)

    expect(duplicates).toEqual([])
  })

  test('exposes canonical major and department mutation routes', () => {
    expect(registeredEndpoints()).toEqual(expect.arrayContaining([
      'PATCH /api/major/:id',
      'DELETE /api/major/:id',
      'PATCH /api/department/:id',
      'DELETE /api/department/:id'
    ]))
  })

  test('protects the canonical major mount', async () => {
    const response = await request(app).get('/api/major').expect(401)

    expect(response.body).toEqual({ message: 'Authentication required' })
  })
})
