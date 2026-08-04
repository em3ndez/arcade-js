// SPDX-License-Identifier: GPL-3.0-only
/**
 * decrementByteAt — take one off the byte at the given address.
 *
 * A shared two-instruction helper: load the byte, subtract one (0 wraps back down to 255), store it
 * back. Nothing else. The target is a parameter, not a fixed cell — it decrements whatever address
 * it is handed.
 *
 * LIVE-OUT: memory-only — the single decremented byte.
 */

/**
 * @param {object} m     the machine (uses m.mem only).
 * @param {number} addr  address of the byte to decrement.
 * @returns {void}
 */
export function decrementByteAt(m, addr) {
  const { mem } = m;
  // Decrement the pointed-at byte; the store wraps 0 down to 255.
  mem.write8(addr, mem.read8(addr) - 1);
}
