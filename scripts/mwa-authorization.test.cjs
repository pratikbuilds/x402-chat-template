const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const { createRequire } = require('node:module')
const { join, dirname } = require('node:path')
const walletRequire = createRequire(require.resolve('@wallet-ui/react-native-kit'))

const protocol = readFileSync(
  join(dirname(walletRequire.resolve('@solana-mobile/mobile-wallet-adapter-protocol')), 'index.native.js'),
  'utf8',
)
const walletUI = readFileSync('node_modules/@wallet-ui/react-native-kit/dist/index.native.mjs', 'utf8')
const errors = protocol.slice(
  protocol.indexOf('const SolanaMobileWalletAdapterErrorCode'),
  protocol.indexOf('//#endregion'),
)
const transport = protocol.slice(
  protocol.indexOf('function getErrorMessage'),
  protocol.indexOf('//#endregion', protocol.indexOf('function getErrorMessage')),
)
const authorize = walletUI.slice(
  walletUI.indexOf('async function authorizeMobileWalletSession'),
  walletUI.indexOf('// src/ellipsify.ts'),
)

function session(native) {
  return new Function(
    'SolanaMobileWalletAdapter',
    'createMobileWalletProxy',
    'assertValidIdentityUri',
    `${errors}\n${transport}\n${authorize}\nreturn { transact, authorizeMobileWalletSession };`,
  )(
    native,
    (_version, request) => ({ authorize: (params) => request('authorize', params) }),
    () => {},
  )
}

test('a rejected cached authorization retries without a token before closing the native session', async () => {
  const calls = []
  const result = { accounts: [{ address: 'test-address' }] }
  const { transact, authorizeMobileWalletSession } = session({
    startSession: async () => ({ protocol_version: 'legacy' }),
    invoke: async (_method, params) => {
      calls.push(params.auth_token ? 'reauthorize' : 'authorize')
      if (params.auth_token)
        throw Object.assign(new Error('-1/authorization request failed'), {
          code: 'JSON_RPC_ERROR',
          userInfo: { jsonRpcErrorCode: -1 },
        })
      return result
    },
    endSession: async () => {
      calls.push('close')
    },
  })
  const account = await transact((wallet) =>
    authorizeMobileWalletSession(
      {
        authToken: 'test-token',
        chain: 'solana:devnet',
        identity: {},
        handleAuthorizationResult: async (value) => ({ selectedAccount: value.accounts[0] }),
      },
      wallet,
    ),
  )
  assert.equal(account.address, 'test-address')
  assert.deepEqual(calls, ['reauthorize', 'authorize', 'close'])
})

test('a declined fresh authorization propagates and closes without repeatedly prompting', async () => {
  let attempts = 0
  let closed = false
  const { transact, authorizeMobileWalletSession } = session({
    startSession: async () => ({ protocol_version: 'legacy' }),
    invoke: async () => {
      attempts++
      throw Object.assign(new Error('declined'), { code: 'JSON_RPC_ERROR', userInfo: { jsonRpcErrorCode: -1 } })
    },
    endSession: async () => {
      closed = true
    },
  })
  await assert.rejects(
    transact((wallet) =>
      authorizeMobileWalletSession(
        {
          authToken: 'test-token',
          chain: 'solana:devnet',
          identity: {},
          handleAuthorizationResult: async () => {},
        },
        wallet,
      ),
    ),
    { code: -1 },
  )
  assert.equal(attempts, 2)
  assert.equal(closed, true)
})
