export type AccessScope = 'local' | 'lan';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export type ScreenOwner = 'vj' | 'baofa' | 'off' | 'diagnostic';

export function getBrowserHost() {
  return typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
}

export function getBrowserProtocol() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
}

export function isLoopbackHost(value: string) {
  return LOOPBACK_HOSTS.has(String(value || '').trim().toLowerCase());
}

export function getAccessScope(host = getBrowserHost()): AccessScope {
  return isLoopbackHost(host) ? 'local' : 'lan';
}

export function getAccessOrigin(port: number) {
  return `${getBrowserProtocol()}//${getBrowserHost()}:${port}`;
}

export function getScreenUrlForOwner(owner: ScreenOwner, screenId: string) {
  const encodedScreenId = encodeURIComponent(screenId);
  if (owner === 'vj') {
    return `${getAccessOrigin(4302)}/screen/${encodedScreenId}`;
  }
  if (owner === 'baofa') {
    return `${getAccessOrigin(4303)}/screen/${encodedScreenId}`;
  }
  return null;
}
