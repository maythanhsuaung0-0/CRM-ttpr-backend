// common function for async and try, catch
// this is a higher order function
// which takes an async function as it's parameter and return an async function

import { promises as fs } from 'fs';
export { generateTokenPair } from './authSecurity.js'



export const catchAsync = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export const readAndParseFileToJSON = async (filePath) => {
  const data = await fs.readFile(filePath, 'utf-8')
  const jsonData = JSON.parse(data)
  return jsonData
}
