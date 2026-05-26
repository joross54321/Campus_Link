/** Shared copy for credit/unit labels across the portal. */
export function unitWord(count: number): string {
  return Math.abs(count) === 1 ? 'unit' : 'units';
}

export function formatUnitsPhrase(count: number): string {
  return `${count} ${unitWord(count)}`;
}

export function formatCapacityPhrase(max: number): string {
  return `Capacity · ${formatUnitsPhrase(max)}`;
}
