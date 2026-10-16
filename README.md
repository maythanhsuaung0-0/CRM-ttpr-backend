# CRM-ttpr-backend
Backend files for CRM ( using expressjs, js, nodejs, mongodb)
# project sturcture explanation

## controlllers/
- this folder is for logics like CRUD for each entity
- create file to manage each entity and have CRUD functions there

## routes/
- this folder is simply using the logics we created in controllers
- create file to import logics and use express router here

## models/
- this folder is for creating entities
- each file represents a table or a collection or an entity in our db
- rules and attributes of our db entities will be found here

# after you create those, don't forget to import in index.js(entry of db).
-------------------------------
## requirements
- npm i
- npm i express mongoose dotenv cors
- npm run start to start running

## Temporary admin for testing

With `ALTAS_URI` configured in your root `.env`, run:

```bash
npm run seed:admin
```

This creates an account with `role: "admin"`, `verified: true`, and `locked: false`.
The command prints its email, generated password, and eight-digit ID. Use the email
and password on the frontend login page. Each run creates a separate test account;
existing users are not modified. Delete the account when you finish testing.

## Automated tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

Tests use Jest and Supertest with native ES modules. The test command enables
Node's VM modules as described in the [Jest ESM documentation](https://jestjs.io/docs/ecmascript-modules).
Coverage reports are written to `coverage/`, including `coverage/lcov-report/index.html`.

Import `app` from `app.js` in request tests. `index.js` loads `.env`, connects to
MongoDB, and starts the backend; `app.js` only builds and exports the Express app.
The tests use test-only secrets and mock Mongoose model methods, so they need no
running backend or MongoDB instance and do not load your development `.env`.
Unmocked database queries fail immediately to help catch missing mocks.

Place new test files under `tests/` with a `.test.js` suffix. See
`tests/auth.test.js` for registration/login examples and `tests/app.test.js` for
protected routes. `tests/commonFunctions.test.js` covers token generation and async
error handling without HTTP requests. Run one file with `npm test -- tests/auth.test.js`.

## to test
- go to postman
- use "localhost:8080/" + the path you used in index.js
-------------------------------
### have fun while coding my team!!
