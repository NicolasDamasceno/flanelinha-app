type UnauthorizedHandler = () => void;

let currentToken: string | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setCurrentToken(token: string | null): void {
  currentToken = token;
}

export function getCurrentToken(): string | null {
  return currentToken;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export function triggerUnauthorized(): void {
  unauthorizedHandler?.();
}
