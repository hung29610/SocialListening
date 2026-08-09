export type AuthSessionState =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED_READY'
  | 'AUTHENTICATED_NOT_READY';

export function shouldInvalidateSession(status: number | undefined): boolean;
export function stateAfterBootstrapResponse(
  status: number,
  authenticated: boolean,
): AuthSessionState;
