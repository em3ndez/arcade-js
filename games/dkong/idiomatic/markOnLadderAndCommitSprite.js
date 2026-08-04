// SPDX-License-Identifier: GPL-3.0-only
/**
 * markOnLadderAndCommitSprite — flag Mario as on a ladder, then refresh his sprite
 * record.  ROM 0x1D49.
 *
 * The tail of the ladder/climb-step path in the movement machine. A climb step
 * arrives here — from loc_1d3f (which has just rewritten Mario's facing/climb sprite
 * code in MARIO_SPRITE_CODE) and from loc_1d51 (the climb-sound arm) — to do two
 * things, in order:
 *
 *   1. set MARIO_ON_LADDER (0x6215) := 1 — re-assert the on-ladder flag on every climb
 *      step; the ladder-end handler loc_1d67 is what later clears it back to 0.
 *   2. tail-jump entry_1da6 (writeMarioSpriteRecord) — copy Mario's just-computed
 *      position + sprite code into his 4-byte hardware sprite record (0x694C..0x694F).
 *
 * The Z80 reaches step 2 via an unconditional `jp 0x1da6`, so entry_1da6's `ret` IS
 * this routine's return. It reads no live-in register (A is loaded with the constant 1;
 * the callee reloads everything it needs from memory), so it takes only `m` and returns
 * nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1d49.test.js.
 * GATE:     crafted-entry — attract's 25m demo climbs, so real captured 0x1d49
 *           dispatches cover the single straight-line arm WITH MARIO_ON_LADDER seen both
 *           0 and 1 at entry (so the flag write is exercised, not vacuous); crafted
 *           entries additionally force 0x6215 != 1 and vary the sprite-source fields to
 *           pin the flag write and the record copy independently. Teeth: a dropped-flag
 *           twin and a dropped-commit twin, both caught.
 * LIVE-OUT: memory-only — MARIO_ON_LADDER (0x6215) := 1 and the four record bytes
 *           0x694C..0x694F (written by writeMarioSpriteRecord). No live registers/flags:
 *           every caller tail-jumps here and the `ret` is unconditional, so the oracle's
 *           residual A (= MARIO_Y) / HL (= 0x694F) / flags are dead ABI — the pc + SP the
 *           gate compares model the single net return.
 * NAMES:    MARIO_ON_LADDER (0x6215) from names.js; the record copy delegates to the
 *           already-idiomatic writeMarioSpriteRecord (ROM 0x1DA6).
 */

import { MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function markOnLadderAndCommitSprite(m) {
  m.mem.write8(MARIO_ON_LADDER, 1); // 0x6215 := 1 — re-assert on-ladder each climb step
  writeMarioSpriteRecord(m);        // tail-jump entry_1da6: refresh the 4-byte sprite record
}
