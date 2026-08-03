// SPDX-License-Identifier: GPL-3.0-only
/**
 * update75mActorObjects — the actor-object scan loop: on 75m, while Mario is alive, update all ten
 * records of the actor object array.  ROM 0x2E04.
 *
 * Two skip gates open the routine, then it walks the ten-record actor array
 * (OBJ_ARRAY_65, stride 16) alongside its paired sprite records (ACTOR_SPRITES, stride 4),
 * handing each object to the per-object updater loc_2e12 exactly once:
 *   • rst 0x30 with the board mask 0x04 (boardBitGate): the gate opens ONLY on board 3
 *     (75m) — bit 2 of the mask is the current-board bit only when BOARD == 3 — so on
 *     25m / 50m / 100m the whole routine is skipped.
 *   • rst 0x10 (marioActiveGuard): Mario must be alive / being processed, else skip.
 * With both gates open it seeds the two scan cursors at the array bases and calls loc_2e12
 * ten times. loc_2e12 reads the current object and its paired sprite record through the
 * cursors and, in its shared advance tail, steps the object cursor by 16 and the sprite
 * cursor by 4 — so ten calls sweep the whole array, one object per pass.
 *
 * NAME: PROMOTED in understanding pass 12, corroborated from outside the file on both halves of the
 * name. The ARRAY half: ram.js names OBJ_ARRAY_65 (0x6500) the object ("actor") array and cites
 * entry_2e04 as its updater, and ACTOR_SPRITES records that entry_2e04 mirrors that array's X/Y into
 * it — two named cells naming this routine. The BOARD half: its boardBitGate mask is 0x04 = board 3,
 * cross-checked against raisePeriodicObjectSpawnRequests's mask 0x0A (boards 2+4) and confirmed
 * independently by search75mObjectOverlap (0x28E0), which sweeps that SAME ten-record array on board
 * 3. Grounding then closed the old "not grounded here" caveat: on a live 75m run OBJ_ARRAY_65 record
 * 0 was active 3711 frames with X sweeping 213 distinct values, and the array was entirely dormant on
 * boards 1, 2 and 4. Naming family: update50mMovingObjects / update50mConveyorObjects.
 * WHAT THIS NAME DOES NOT CLAIM: WHICH Donkey Kong actors these ten records are. Records 2-9 never
 * activated in any run (OBJ_ARRAY_65 is an honest PARTIAL [seen], records 0-1 only), so the name says
 * "actor objects" — the registry's own vocabulary — and does not identify them.
 *
 * The object and sprite cursors are carried in registers into loc_2e12 (its current honest
 * signature reads them there — a genuine callee boundary), so this routine seeds them the
 * same way the oracle does before the first pass and lets loc_2e12 advance them.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e04.test.js.
 * GATE:     captured + crafted. Real attract dispatches exercise the rst-0x30-closed skip
 *           (attract plays 25m, so the board gate is shut). Crafted entries on a real
 *           attract base then drive board 3 with Mario dead (the rst-0x10-closed skip), the
 *           full ten-object loop with objects seeded across all four loc_2e12 arms, and the
 *           mask edges (boards 1/2/4 all closed, board 3 open). The RAM diff excludes the
 *           dead STACK_SCRATCH the oracle's rst push16/ret churn and loc_2e12's spawn-arm
 *           push/ret write; pc + SP are compared after modelling the single terminal
 *           caller-return that every path nets (one m.ret()). Teeth: twins that skip the
 *           alive gate, skip the board gate, use the wrong board mask, run the wrong object
 *           count, and start at the wrong array base.
 * LIVE-OUT: memory-only. entry_2e04 is called by the per-frame cascade loc_197a, which
 *           issues its next call without reading any register this routine leaves (the
 *           residual A / IX / IY / B / DE are all dead). The two boolean-guard returns
 *           replace the rst-0x30 / rst-0x10 caller-skip stack idiom; the terminal ret pops
 *           the one caller-return every path consumes.
 * NAMES:    OBJ_ARRAY_65 (0x6500 actor object array), ACTOR_SPRITES (0x6980 paired sprite
 *           array) — from ram.js. The board mask 0x04 and the record count 10 are literals.
 *           Callees direct-called: boardBitGate (ROM 0x0030, reads regs.a + BOARD 0x6227),
 *           marioActiveGuard (ROM 0x0010, reads MARIO_ACTIVE 0x6200), loc_2e12 (ROM 0x2E12,
 *           reads and advances the two cursors in registers).
 */

import { OBJ_ARRAY_65, ACTOR_SPRITES } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js";        // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js"; // ROM 0x0010 (rst 0x10)
import { loc_2e12 } from "./loc_2e12.js";                 // ROM 0x2E12

const BOARD_MASK = 0x04; // rst-0x30 applicability mask: the current-board bit only on board 3 (75m)
const ACTOR_COUNT = 10;  // records in the actor object array (OBJ_ARRAY_65, stride 16)

export function update75mActorObjects(m) {
  const { regs } = m;

  // Gate 1 — rst 0x30 board test. boardBitGate reads the mask from regs.a; mask 0x04
  // selects the current-board bit only on board 3 (75m).
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // not 75m -> skip the whole scan

  // Gate 2 — rst 0x10 alive test (reads MARIO_ACTIVE, no register input).
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Seed the two scan cursors at the array bases. loc_2e12 advances them itself (object
  // cursor +16, sprite cursor +4) in its shared tail, so ten calls sweep the whole array.
  regs.ix = OBJ_ARRAY_65;  // object-record scan cursor (0x6500, stride 16)
  regs.iy = ACTOR_SPRITES; // paired sprite-record scan cursor (0x6980, stride 4)
  for (let i = 0; i < ACTOR_COUNT; i++) {
    loc_2e12(m);
  }
}
