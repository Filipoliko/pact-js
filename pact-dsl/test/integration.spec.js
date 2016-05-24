import { expect } from 'chai'
import Promise from 'bluebird'
import path from 'path'
import request from 'superagent-bluebird-promise'
import Interceptor from 'pact-interceptor'

var wrapper = require('@pact-foundation/pact-node')

import Pact from '../src/pact'
import server from './provider'

describe('Pact', () => {

  const PORT = Math.floor(Math.random() * 999) + 9000
  const PROVIDER_URL = `http://localhost:${PORT}`
  const mockServer = wrapper.create({
    port: 1234,
    log: path.resolve(process.cwd(), 'logs', 'mockserver.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    spec: 2
  })
  const interceptor = new Interceptor('http://localhost:1234')
  const EXPECTED_BODY = [{
    id: 1,
    name: 'Project 1',
    due: '2016-02-11T09:46:56.023Z',
    tasks: [
      {id: 1, name: 'Do the laundry', 'done': true},
      {id: 2, name: 'Do the dishes', 'done': false},
      {id: 3, name: 'Do the backyard', 'done': false},
      {id: 4, name: 'Do nothing', 'done': false}
    ]
  }]

  var pact

  before((done) => {
    server.listen(PORT, () => {
      pact = Pact({ consumer: 'Test DSL', provider: 'Projects' })
      done()
    })
  })

  beforeEach((done) => {
    mockServer.start().then(() => {
      interceptor.interceptRequestsOn(PROVIDER_URL)
      done()
    })
  })

  afterEach((done) => {
    mockServer.stop().then(() => {
      interceptor.stopIntercepting()
      done()
    })
  })

  context('with a single request', () => {
    it('successfully verifies', (done) => {
      function requestProjects () {
        return request.get(`${PROVIDER_URL}/projects`).set({ 'Accept': 'application/json' })
      }

      pact.interaction()
        .given('i have a list of projects')
        .uponReceiving('a request for projects')
        .withRequest('get', '/projects', null, { 'Accept': 'application/json' })
        .willRespondWith(200, { 'Content-Type': 'application/json' }, EXPECTED_BODY)

      pact.verify(requestProjects)
        .then((data) => {
          expect(JSON.parse(data)).to.eql(EXPECTED_BODY)
          done()
        })
        .catch((err) => {
          done(err)
        })
    })
  })

  context('with two requests request', () => {
    it('successfully verifies', (done) => {
      function requestProjects () {
        return Promise.all([
          request.get(`${PROVIDER_URL}/projects`).set({ 'Accept': 'application/json' }),
          request.get(`${PROVIDER_URL}/projects/2`).set({ 'Accept': 'application/json' })
        ])
      }

      pact.interaction()
        .given('i have a list of projects')
        .uponReceiving('a request for projects')
        .withRequest('get', '/projects', null, { 'Accept': 'application/json' })
        .willRespondWith(200, { 'Content-Type': 'application/json' }, EXPECTED_BODY)

        pact.interaction()
          .given('i have a list of projects')
          .uponReceiving('a request for a project that does not exist')
          .withRequest('get', '/projects/2', null, { 'Accept': 'application/json' })
          .willRespondWith(404, { 'Content-Type': 'application/json' })

      pact.verify(requestProjects)
        .then((responses) => {
          expect(JSON.parse(responses[0])).to.eql(EXPECTED_BODY)
          expect(JSON.parse(responses[1])).to.eql('')
          done()
        })
        .catch((err) => {
          done(err)
        })
    })
  })

  context('with an unexpected interaction', () => {
    it('fails verification', (done) => {
      function requestProjects () {
        return Promise.all([
          request.get(`${PROVIDER_URL}/projects`).set({ 'Accept': 'application/json' }),
          request.delete(`${PROVIDER_URL}/projects/2`)
        ])
      }

      pact.interaction()
        .given('i have a list of projects')
        .uponReceiving('a request for projects')
        .withRequest('get', '/projects', null, { 'Accept': 'application/json' })
        .willRespondWith(200, { 'Content-Type': 'application/json' }, EXPECTED_BODY)

      pact.verify(requestProjects)
        .catch((err) => {
          expect(err.shift()).to.contain('No interaction found for DELETE /projects/2')
          done()
        })
    })
  })

})
