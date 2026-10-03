export function acceptsVersion(currentVersion: number, incomingVersion: number): boolean {
  return incomingVersion > currentVersion;
}
