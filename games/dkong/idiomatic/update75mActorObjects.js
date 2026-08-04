// SPDX-License-Identifier: GPL-3.0-only
/**
 * update75mActorObjects — the actor-object scan loop: on 75m, while Mario is alive, update all ten
 * records of the actor object array.
 *
 * Two skip gates open the routine, then it walks the ten records of OBJ_ARRAY_65 (stride 16)
 * alongside their paired ACTOR_SPRITES records (stride 4), handing each object to the per-object
 * updater exactly once:
 *   • The shared per-board gate with mask 0x04. That bit is the current board's bit only on board 3
 *     (75m), so on 25m / 50m / 100m the whole routine is skipped.
 *   • The shared alive gate: Mario must be alive and being processed, else skip.
 * With both gates open it seeds the two scan cursors at the array bases and calls the per-object
 * updater ten times. That updater reads the current object and its paired sprite record through the
 * cursors and, in its shared advance tail, steps the object cursor by 16 and the sprite cursor by 4
 * — so ten calls sweep the whole array, one object per pass.
 *
 * WHAT THE NAME CLAIMS. The BOARD half is derivable right here: mask 0x04 is board 3 and nothing
 * else. The ARRAY half — that these ten records are ACTOR objects — is the vocabulary the array's
 * own name carries, not something this body proves. WHAT IT DOES NOT CLAIM: WHICH characters the ten
 * records are. The name says "actor objects" and identifies none of them.
 *
 * Reads: BOARD and the alive flag, both through the shared gates. Writes: nothing of its own —
 * every write is the per-object updater's.
 * LIVE-OUT: memory-only. The per-frame cascade above issues its next call without reading any
 * register this routine leaves.
 */

import { OBJ_ARRAY_65, ACTOR_SPRITES } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";         // the shared per-board gate
import { marioActiveGuard } from "./marioActiveGuard.js"; // the shared alive gate
import { advanceSpring } from "./advanceSpring.js";       // the per-object updater

const BOARD_MASK = 0x04; // applicability mask: the current-board bit only on board 3 (75m)
const ACTOR_COUNT = 10;  // records in the actor object array (OBJ_ARRAY_65, stride 16)

export function update75mActorObjects(m) {
  const { regs } = m;

  // Gate 1 — the board test. The gate reads its mask from the accumulator; mask 0x04 selects
  // the current-board bit only on board 3 (75m).
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // not 75m -> skip the whole scan

  // Gate 2 — the alive test. It reads MARIO_ACTIVE and takes no register input.
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Seed the two scan cursors at the array bases. The updater advances them itself — object
  // cursor +16, sprite cursor +4 — in its shared tail, so ten calls sweep the whole array.
  regs.ix = OBJ_ARRAY_65;  // object-record scan cursor, stride 16
  regs.iy = ACTOR_SPRITES; // paired sprite-record scan cursor, stride 4
  for (let i = 0; i < ACTOR_COUNT; i++) {
    advanceSpring(m);
  }
}
