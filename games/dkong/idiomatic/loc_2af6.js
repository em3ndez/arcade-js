// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2af6 — pick the drift step for this platform row by Mario's X, then move him.
 * ROM 0x2AF6.
 *
 * One arm of the moving-platform row mover (the row whose Mario Y is 0x78). Object-2's
 * signed drift step is published as two shadow bytes — a positive arm and a negative arm —
 * and Mario's current X selects which one applies: from the far-right half of the range
 * (X >= 0x80) the positive step is used, otherwise the negative step. The chosen step is
 * handed to the shared X mover as the drift velocity, which advances Mario's X by it and
 * holds him inside the horizontal limits. Mario's prior X carries through unchanged as the
 * mover's other input.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2af6.test.js.
 * GATE:     crafted-entry — attract never rides the moving-platform rows (0 real 0x2AF6
 *           dispatches in 3000 frames), so entries are crafted on a real attract base: a
 *           sweep of all 256 prior-X values (both halves of the range, both bytes of the
 *           X==0x80 boundary) x distinct positive/negative shadow steps x board parity x Y
 *           band drives both selector arms and, through the mover, every position-gate
 *           verdict. The dropped tail-jump ret bracket's dead STACK_SCRATCH is excluded from
 *           the RAM diff. Teeth: an inverted boundary, an off-by-one boundary, and a dropped
 *           selection. Reached only via sub_2ad3.
 * LIVE-OUT: memory-only (MARIO_X, MARIO_SPRITE_RECORD, both written inside the mover). The
 *           prior X arrives in a register at the still-translated caller (sub_2ad3) boundary;
 *           nothing downstream reads a register or flag this routine leaves — it tail-returns.
 * NAMES:    M50_OBJ2_STEP_POS (0x63A5), M50_OBJ2_STEP_NEG (0x63A4) — the two published
 *           step-shadow arms this routine selects between — from ram.js. MARIO_X (0x6203) and
 *           MARIO_SPRITE_RECORD (0x694C) are written by the moveMarioX callee (ROM 0x2B02,
 *           direct-called; marshals the selected step in as its velocity).
 */

import { M50_OBJ2_STEP_POS, M50_OBJ2_STEP_NEG } from "./ram.js";
import { moveMarioX } from "./moveMarioX.js"; // ROM 0x2B02 — advance X by velocity + clamp

export function loc_2af6(m) {
  const { regs, mem } = m;

  // Mario's X selects the sign of object-2's published drift step: the far-right half of the
  // range (X >= 0x80) takes the positive-step shadow, the left half takes the negative one.
  const step = regs.b >= 0x80 ? mem.read8(M50_OBJ2_STEP_POS) : mem.read8(M50_OBJ2_STEP_NEG);

  // Hand the chosen step to the shared X mover as the drift velocity; Mario's prior X stays
  // in its register as the mover's other input.
  regs.a = step;
  moveMarioX(m);
}
