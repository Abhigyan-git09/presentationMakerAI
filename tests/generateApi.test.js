import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/generate.js'

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

test('Gemini proxy rejects non-POST requests before reading secrets', async () => {
  const response = mockResponse()
  await handler({ method: 'GET', headers: {} }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(response.headers.Allow, 'POST')
  assert.equal(response.headers['Cache-Control'], 'no-store')
  assert.deepEqual(response.payload, { error: 'Method not allowed' })
})

test('Gemini proxy rejects unauthenticated requests before reading secrets', async () => {
  const response = mockResponse()
  await handler({ method: 'POST', headers: {} }, response)

  assert.equal(response.statusCode, 401)
  assert.equal(response.headers['Cache-Control'], 'no-store')
  assert.deepEqual(response.payload, { error: 'Authentication required' })
})
