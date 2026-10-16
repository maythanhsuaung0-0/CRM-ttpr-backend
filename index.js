import 'dotenv/config'
import app from './app.js'
import connection from './config/connection.js'

const port = process.env.PORT
connection()

app.listen(port, () => {
  console.log(`backend is running at localhost:${port}`)
})
