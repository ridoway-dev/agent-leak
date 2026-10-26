/**
 * Shannon entropy calculation for detecting high-randomness strings.
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  const len = str.length;

  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Checks if a string has high entropy typical of cryptographic keys or random tokens.
 * Base64 or Hex tokens usually have entropy > 3.5 - 4.5.
 */
export function isHighEntropy(str: string, threshold = 3.8): boolean {
  if (!str || str.length < 16) return false;
  return calculateShannonEntropy(str) >= threshold;
}
