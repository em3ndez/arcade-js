// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2787 — advance Mario's vertical position by one, or hand off to the edge
 * reset once it reaches the bottom limit.  ROM 0x2787.
 *
 * One of a pair of vertical movers (its sibling at 0x276F steps the counterpart).
 * It reads MARIO_Y and, while that value is still below the 232 limit, advances
 * it by one and mirrors the new value into the Y field of Mario's sprite record
 * so the drawn sprite tracks the move. The moment MARIO_Y is at or past the limit
 * it stops moving and hands off to loc_277f, the edge reset — which switches the
 * mover off (MARIO_ACTIVE = 0) and clears EDGE_REPOSITION_FLAG.
 *
 * The single input is MARIO_Y; the branch and every write are decided by it.
 *
 * NAME: kept the neutral loc_. The mechanism is exact against the oracle, but
 * which scripted movement this drives — and whether it reads as "up" or "down"
 * on screen — is not confirmed to the routine-name bar, so the purpose stays
 * open (its sibling edge reset loc_277f is held for the same reason). Promote
 * once corroborated.
 *
 * A NEAR-LEAF: reads MARIO_Y, writes MARIO_Y and the sprite-record Y; on the
 * reset arm it direct-calls loc_277f. Returns nothing a caller consumes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2787.test.js.
 * GATE:     exhaustive over the sole input — all 256 MARIO_Y values on a real
 *           attract base — since the branch and every write depend only on it;
 *           this covers both the step arm (below the limit) and the edge-reset
 *           arm (at/above it). The RAM diff excludes the dead STACK_SCRATCH: the
 *           oracle models its tail-jump to loc_277f as a call and ends every path
 *           with a `ret` that only pops the stack, so that pop is dead ABI.
 *           0x2787 is a gameplay-only mover — not dispatched in attract — so
 *           there are no real captured dispatches; the exhaustive sweep is the proof.
 * LIVE-OUT: memory-only (MARIO_Y and the sprite-record Y on the step arm; and,
 *           via loc_277f on the reset arm, MARIO_ACTIVE and EDGE_REPOSITION_FLAG).
 *           The oracle's residual accumulator/flags and its terminal return are
 *           dead ABI — the per-frame mover chain that runs this discards them.
 * NAMES:    MARIO_Y (0x6205), MARIO_SPRITE_RECORD (0x694C) + SPRITE_Y (0x03) from
 *           ram.js; loc_277f (ROM 0x277F) direct-called with no register inputs.
 *           The 232 limit is a plain position threshold, not a named cell.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./ram.js";
import { loc_277f } from "./loc_277f.js"; // ROM 0x277F — edge reset

// Mario's sprite-record Y field: the position byte the display reads for him.
// The mover mirrors MARIO_Y here so the sprite follows the move.
const MARIO_SPRITE_Y = MARIO_SPRITE_RECORD + SPRITE_Y;

// The position advances up to, but never past, this value; at the limit the
// mover hands off to the edge reset instead of moving.
const Y_LIMIT = 232;

/**
 * @param {object} m  the machine (uses m.mem, and calls loc_277f on the reset arm).
 * @returns {void}
 */
export function loc_2787(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // At or past the limit: stop moving and run the edge reset.
  if (y >= Y_LIMIT) {
    loc_277f(m);
    return;
  }

  // Otherwise advance the position by one and mirror the new value to the sprite.
  const next = y + 1;
  mem.write8(MARIO_Y, next);
  mem.write8(MARIO_SPRITE_Y, next);
}
