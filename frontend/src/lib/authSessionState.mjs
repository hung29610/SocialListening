/** Only a proven authentication failure invalidates a persisted session. */
export function shouldInvalidateSession(status) {
  return status === 401;
}

/** Readiness and authorization failures preserve an authenticated session. */
export function stateAfterBootstrapResponse(status, authenticated) {
  if (shouldInvalidateSession(status) || !authenticated) return 'UNAUTHENTICATED';
  return status >= 200 && status < 300
    ? 'AUTHENTICATED_READY'
    : 'AUTHENTICATED_NOT_READY';
}
