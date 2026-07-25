// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_0000  (ROM 0x0000-0x0002) — the Z80 RESET vector: jump straight to the
 * boot entry at 0x01A4.
 *
 *   0000  c3 a4 01     jp   0x01a4
 *
 * Power-on PC is 0x0000, so this is the first thing the CPU fetches. The reset
 * vector is a single unconditional jump into the real initialisation code at
 * 0x01A4; it pushes nothing and never returns here (boot falls through into the
 * main loop, which spins on vblank forever).
 *
 * Modelled the way the DK oracle models every unconditional tail-jump
 * (branch_1fe5 / branch_1fac / branch_2053): advance PC + charge the 10 T-states
 * of `jp nn`, then `return m.call(target)` so the target's own control flow — its
 * eventual `ret`, or here its non-return — propagates back through the JS stack
 * unchanged. This is NOT the `m.call(target); m.ret()` shape: that shape models a
 * real `call` (which pushes a return address) immediately followed by a real
 * `ret` instruction, which for a plain `jp` would push a spurious word onto the
 * diffed stack RAM and add a second ret's worth of cycles (27 T total, not 10).
 * A JP pushes nothing and performs no ret of its own.
 */
export function entry_0000(m) {
  m.step(0x01a4, 10); // jp 0x01a4
  return m.call(0x01a4);
}
