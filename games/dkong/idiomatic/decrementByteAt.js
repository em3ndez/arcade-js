// SPDX-License-Identifier: GPL-3.0-only
/**
 * decrementByteAt — subtract one from the byte at the given address (0 wraps to 255).
 *
 * LIVE-OUT: memory-only — the single decremented byte.
 */
export function decrementByteAt(m, addr) {
  const { mem8 } = m;
  mem8[addr] = mem8[addr] - 1;
}
