import jwt from 'jsonwebtoken'
import { ACCESS_COOKIE_NAME, verifyAccessToken } from '../utils/authSecurity.js'

export const checkToken = (req, res, next) => {
  const authorization = req.headers.authorization
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
  const token = bearerToken || req.cookies?.[ACCESS_COOKIE_NAME]

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    req.UserData = verifyAccessToken(token)
    return next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Access token expired' })
    }
    return res.status(401).json({ message: 'Invalid access token' })
  }
}

