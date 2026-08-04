// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioDownWithLift — carry Mario one pixel DOWN the screen while he rides a
 * descending lift, or kill him once he reaches the bottom of his OWN run.  ROM 0x2787.
 *
 * One arm of dispatchElevatorRideByColumn (ROM 0x2745), chosen while Mario's X sits
 * in the [0x6C, 0x83) band — the DESCENDING column, the one a lift enters when its X
 * is set to 0x77 (119) at the top of the climb. That motion belongs to
 * advanceBoardObjectTravel (ROM 0x2797), which owns that write and calls it a LANDING
 * (LANDED_X = 119) — a single store of the X byte, ROM 0x27BA `ld (ix+3),0x77`. Its sibling
 * carryMarioUpWithLift (ROM 0x276F) is the rising column's arm.
 *
 * It reads MARIO_Y and, while that value is still below the 232 limit, advances it by
 * one — a single pixel DOWN the screen, since a larger Y is lower — and mirrors the new
 * value into the Y field of Mario's sprite record so the drawn sprite tracks the move.
 * The moment MARIO_Y is at or past the limit his run is over, and it hands off to
 * killMarioAtEndOfLiftTravel, which zeroes MARIO_ACTIVE — the game's kill primitive:
 * Mario dies, the death animation runs and a life is lost — and clears
 * EDGE_REPOSITION_FLAG.
 *
 * The single input is MARIO_Y; the branch and every write are decided by it.
 *
 * THE LIMIT IS AN ABSOLUTE MARIO_Y ROW, NOT THE LIFT'S END OF TRAVEL. This routine reads
 * no object record; it compares MARIO_Y against 232 and nothing else. A rider's Y is
 * stamped OBJ_Y - 12 when he boards (ROM 0x29E0-E2) and the measured gap held at 11-12
 * through the ride, so he hits row 232 with the lift around OBJ_Y 243-244, while the
 * descending column runs on to OBJ_Y 248 before deactivating (ROM 0x27CE). The two
 * places are 4-5 px apart here — much closer than on the up arm, where the same
 * lift-relative reading is off by 27-28 px — but they are still different tests, and it
 * is Mario's row that this code checks. The sibling routine's name, "end of lift travel",
 * is the lift-relative reading of it.
 *
 * There is no SHAFT drawn: the pixel grounding (below) shows an exposed vertical rail with
 * a drive housing at each end — no enclosure, no car, no doors — so this file says "the
 * lift's run".
 *
 * NAME: promoted from loc_2787 in understanding pass 15 (proposer != confirmer; both
 * derivations independently said "one pixel DOWN the screen"). ★ This settles the
 * direction question the pre-promotion header left open — whether it reads as up or down
 * on screen was "not confirmed to the routine-name bar" — and it is settled from OUTSIDE
 * the routine (R5), twice over. MARIO_Y (0x6205) is `[seen]` in names.js as "larger = lower
 * on screen", so this arm's `inc` is down; and the descending column was measured on a
 * live 75m board, where OBJ_ARRAY_66 (0x6600) `[seen]` records sit at X = 119 and have
 * their Y INCREASE 96 -> 248, travelling down. The lockstep is measured too: 62
 * dispatches, 61 of them the step arm, MARIO_Y 171 -> 232 = exactly those 61 steps, with
 * the lift-to-Mario gap pinned at the same 11-12 px as the up arm.
 *
 * "LIFT" IS PIXEL-GROUNDED, not inferred from the motion alone: each of the six
 * OBJ_ARRAY_66 records draws sprite code 0x44, which decodes out of gfx2.bin as a 16x8
 * X-braced TRUSS PLATFORM — isolated per-actor in real MAME by blanking every other
 * sprite's code byte at the DMA latch and diffing frames. Its collision half-extents
 * (+9/+0x0A = 8/4) are exactly that drawn box, and Mario's feet ride its top row at the
 * 11-12 px gap. Yellow riveted drive housings (sprite 0x45) sit at the head and foot of
 * each rail, spanning the very rows the ROM's own limits name — OBJ_Y 96 and 248 (ROM
 * 0x27B5/0x27CE). (spawnBoardObject, which seeds the same six records, still says "The
 * concrete kind of object spawned is not grounded here"; that predates this grounding,
 * and lifting it is that file's edit, not this one's.)
 *
 * A NEAR-LEAF: reads MARIO_Y, writes MARIO_Y and the sprite-record Y; on the
 * end-of-run arm it direct-calls killMarioAtEndOfLiftTravel. Returns nothing a caller
 * consumes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2787.test.js.
 * GATE:     exhaustive over the sole input — all 256 MARIO_Y values on a real
 *           attract base — since the branch and every write depend only on it;
 *           this covers both the step arm (below the limit) and the end-of-run
 *           arm (at/above it). The RAM diff excludes the dead STACK_SCRATCH: the
 *           oracle models its tail-jump to killMarioAtEndOfLiftTravel as a call and
 *           ends every path with a `ret` that only pops the stack, so that pop is
 *           dead ABI. 0x2787 is a gameplay-only carry — not dispatched in attract —
 *           so no dispatch was captured for this gate; the exhaustive sweep is the
 *           proof. ★ That is a coverage hole, not an impossibility: a real 75m ride
 *           has since put 62 dispatches through it (61 step + 1 hand-off).
 * LIVE-OUT: memory-only (MARIO_Y and the sprite-record Y on the step arm; and, via
 *           killMarioAtEndOfLiftTravel on the end-of-run arm, MARIO_ACTIVE and
 *           EDGE_REPOSITION_FLAG). The oracle's residual accumulator/flags and its
 *           terminal return are dead ABI — the per-frame chain that runs this
 *           discards them.
 * NAMES:    MARIO_Y (0x6205), MARIO_SPRITE_RECORD (0x694C) + SPRITE_Y (0x03) from
 *           names.js; killMarioAtEndOfLiftTravel (ROM 0x277F) direct-called with no
 *           register inputs. The 232 limit is a plain position threshold, not a
 *           named cell.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js"; // ROM 0x277F — the kill at this arm's limit

// Mario's sprite-record Y field: the position byte the display reads for him.
// The carry mirrors MARIO_Y here so the sprite follows the move.
const MARIO_SPRITE_Y = MARIO_SPRITE_RECORD + SPRITE_Y;

// The bottom of Mario's own run, as an absolute screen row (larger Y is lower on screen).
// His Y advances up to, but never past, this value; at the limit the carry hands off to the
// kill instead of moving. Nothing here consults the lift, which runs 4-5 px further down.
const Y_LIMIT = 232;

/**
 * @param {object} m  the machine (uses m.mem, and calls killMarioAtEndOfLiftTravel at
 *                    the bottom of the run).
 * @returns {void}
 */
export function carryMarioDownWithLift(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // At or past the bottom of his run: stop moving and kill Mario.
  if (y >= Y_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  // Otherwise step him one pixel down the screen and mirror the new Y to the sprite.
  const next = y + 1;
  mem.write8(MARIO_Y, next);
  mem.write8(MARIO_SPRITE_Y, next);
}
