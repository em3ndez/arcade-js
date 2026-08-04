// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d83 — restart the per-entry emitter at the head of a fixed source sequence and emit that
 * sequence's first entry.
 *
 * The emitter it restarts walks a sequence of bytes in program memory, turning each one into a
 * 4-byte sprite record, and it keeps its place in RENDER_STR_PTR. This routine is the branch
 * that puts the walk back at the beginning: it hands the head of the sequence to the emitter as
 * a cursor and stamps the same address into RENDER_STR_PTR, then lets the emitter run once.
 *
 * The cursor is the live hand-off; the stamp into RENDER_STR_PTR is only a starting value. The
 * first entry of this sequence is never the terminator, so the emitter always takes its emit
 * path and immediately advances RENDER_STR_PTR past the entry it just consumed — overwriting the
 * stamp before anything can read it. The stamp carries no state forward on the reachable path.
 *
 * The branch here is taken while the object being dressed is a barrel that has just claimed a
 * release slot, in ordinary 25m play rather than in any cutscene.
 *
 * NOT CLAIMED: what the source sequence draws. Its entries have never been matched to anything
 * on screen, so nothing here says what the emitted records look like — only how the walk is
 * restarted and that its first entry is always emitted.
 *
 * LIVE-OUT: memory-only — the restarted RENDER_STR_PTR (immediately re-advanced) and the sprite
 * record the emitter lays down for the first entry.
 */

import { RENDER_STR_PTR } from "./names.js";
import { stepBarrelAlongReleasePath } from "./stepBarrelAlongReleasePath.js";

/** Head of the source sequence this restart aims the emitter at; it lives in program memory. */
const STRING_START = 0x39cc;

export function loc_2d83(m) {
  const { regs, mem } = m;

  // Put the walk back at the head of the sequence: hand the emitter its cursor, and stamp
  // the same address into the kept-place cell (which the emitter then advances past).
  regs.hl = STRING_START;
  mem.write16(RENDER_STR_PTR, STRING_START);

  // Emit the first entry's record — on this sequence that path is always taken.
  return stepBarrelAlongReleasePath(m);
}
