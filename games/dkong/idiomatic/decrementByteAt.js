// SPDX-License-Identifier: GPL-3.0-only
/**
 * decrementByteAt — decrement the byte at the given address by one.  ROM 0x2806.
 *
 * A two-instruction shared helper: load the byte the caller points at, subtract
 * one (wrapping 0 back down to 255), and store it back. Nothing else.
 *
 * The one caller — the board-object spawn routine at ROM 0x27DA — tail-jumps here to
 * tick down a spawn-cooldown timer every time it runs, whether or not it spawned this
 * pass. In that use the pointer is a single board-object bookkeeping cell, but the
 * routine itself is address-agnostic: it decrements whatever address it is handed, so
 * the target is a parameter rather than a fixed cell.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2806.test.js.
 * GATE:     crafted-entry — the spawn cascade this sits under is never reached in
 *           attract, so there are no natural dispatches to capture. Validated instead
 *           by an EXHAUSTIVE sweep over the only input that moves the output — all 256
 *           values of the target byte — at the real spawn-timer cell, plus crafted
 *           pointers spanning work / sprite / video RAM to prove the supplied address
 *           is honoured. Teeth: an increment twin and a fixed-address twin that
 *           ignores the pointer.
 * LIVE-OUT: memory-only — the single decremented byte. The oracle's decrement flags
 *           (zero / sign / half-carry / overflow) and its terminal return are dead:
 *           the sole caller tail-jumps in, and ITS caller (ROM 0x2722) resumes its own
 *           work — reloading registers — without reading the returned flags.
 * NAMES:    none — the target is a parameter (the pointer live-in), so this routine
 *           references no ram.js cell. In the observed use the caller passes 0x62A7,
 *           an as-yet-unnamed board-object spawn-cooldown cell.
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
