import assert from 'node:assert/strict';
import {
  shouldInvalidateSession,
  stateAfterBootstrapResponse,
} from '../src/lib/authSessionState.mjs';

assert.equal(shouldInvalidateSession(401), true);
for (const status of [403, 429, 500, 503]) {
  assert.equal(shouldInvalidateSession(status), false, `${status} must preserve auth`);
  assert.equal(
    stateAfterBootstrapResponse(status, true),
    'AUTHENTICATED_NOT_READY',
  );
}
assert.equal(stateAfterBootstrapResponse(200, true), 'AUTHENTICATED_READY');
assert.equal(stateAfterBootstrapResponse(401, true), 'UNAUTHENTICATED');
assert.equal(stateAfterBootstrapResponse(503, false), 'UNAUTHENTICATED');

console.log('AUTH_READINESS_CONTRACT_CASES=8');
