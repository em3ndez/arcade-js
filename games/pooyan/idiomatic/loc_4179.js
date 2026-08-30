// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4179 — phantom no-op: a one-instruction handler that just returns.
 * ROM 0x4179. [seen]
 *
 * WHAT IT IS. A single `ret` at ROM 0x4179 — a call target that does no work and hands control
 * straight back. Boards of this era leave such stub handlers wherever a table or state slot must
 * point at *something* callable but the corresponding case is meant to do nothing: the machinery
 * invokes it uniformly, and this entry is the deliberate "and here, nothing happens" case. It ends
 * exactly at the 0x417a boundary, so it occupies that one byte and no more.
 *
 * WHAT IT DOES. Nothing. It touches no memory, no registers, and no flags, and returns immediately.
 *
 * LIVE-OUT: none.
 */
export function loc_4179(m) {
  // Bare return — the whole routine. No RAM, register, or flag is touched.
  return;
}
