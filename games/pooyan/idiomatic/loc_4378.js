// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4378 — phantom no-op handler: a routine that does nothing and returns.
 *
 * ROM address: 0x4378 (a single-byte body, `ret`). Grounding tag: [seen].
 *
 * This is a called stub — a routine that exists only so a caller has a valid target to reach,
 * but whose job is to have NO effect. Its whole body on the machine is one return instruction:
 * it touches no memory, no hardware register, and no state of any kind, then hands control
 * straight back to whoever reached it. Stubs like this are how the original ROM fills a slot in
 * a table of handlers, or occupies a code path, that is meant to be inert for this game — the
 * caller dispatches uniformly and the "do nothing" case is spelled as a real, callable routine
 * rather than a special-cased skip.
 *
 * Because it reads and writes nothing, it is safe to reach from anywhere and in any order; it
 * cannot fail and cannot perturb the machine.
 *
 * LIVE-OUT: none — the machine is left exactly as it was found.
 */
export function loc_4378(m) {
  // Nothing to do: the ROM body is a bare return, so this routine has no memory or hardware
  // effect. Control simply falls back to the caller.
  return;
}
