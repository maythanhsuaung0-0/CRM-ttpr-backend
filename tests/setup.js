import mongoose from 'mongoose'

// Use test-only values without loading the development .env file.
process.env.NODE_ENV = 'test'
process.env.ACCESS_TOKEN_SECRET_KEY = 'jest-access-secret-for-tests-only'
process.env.REFRESH_TOKEN_SECRET_KEY = 'jest-refresh-secret-for-tests-only'
process.env.ALTAS_URI = 'mongodb://127.0.0.1:1/crm_test'

// An unmocked query should fail immediately rather than wait for a connection.
mongoose.set('bufferCommands', false)
