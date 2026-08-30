// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_28c5 — phantom no-op: an addressable do-nothing.  [seen]
 *
 * ROM 0x28c5, a single-byte routine that only returns. Two parts of the machine reach it, and
 * both want a target that costs a frame's dispatch and changes nothing:
 *
 *   - It is the IDLE state of the launch state machine (LAUNCH_STATE, 0x8f30): when that
 *     machine's selector picks state 4 there is genuinely nothing to advance, so the entry
 *     points here and falls straight through.
 *   - It is also the landing a neighbouring routine returns to — a placeholder continuation
 *     that simply resumes normal flow.
 *
 * Because it touches no memory, keeping it as a real, addressable routine (rather than folding
 * it away) preserves the exact state-table layout the ROM indexes into.
 *
 * LIVE-OUT: none — no memory or observable state is altered.
 */
export function loc_28c5(m) {
  return;
}
