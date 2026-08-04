// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mObjectDown — the descend arm of the 50m board-object state machine: tick this object's
 * timer, step its position counter up — which moves the object DOWN the screen — mirror the new
 * position to its sprite, advance the state at the bottom of travel, then, while Mario is standing
 * on the object's column, settle his climb one pixel at a time.  ROM 0x2259.
 *
 * dispatch50mObjectState (ROM 0x2207) selects one of two 8-byte board-object records by frame
 * parity and dispatches on the object's state byte to one of four arms; this is the state-1 arm.
 * It is the mirror of the sibling arm raise50mObjectAndPark: that arm steps the position counter
 * DOWN toward its minimum 0x68 — the object's HIGHEST point on screen — and resets the record;
 * this arm steps it UP toward its maximum 0x78, the object's LOWEST point, and advances the state.
 * (The counter IS a screen Y and larger is lower; grounded in raise50mObjectAndPark.js's VERTICAL
 * CONVENTION block.) The record fields it touches:
 *   +0  the object's state (advanced by one when the counter reaches its maximum — the bottom
 *       of travel, lowest on screen)
 *   +2  the object's column — the X Mario must be standing on (fed to the hit test)
 *   +3  the position counter, stepped UP by one (moving the object DOWN the screen) and
 *       mirrored to the object's sprite cell
 *   +4  a per-tick timer, counted down one step every time this arm runs
 *
 * What it does:
 *   1. Count the timer (+4) down by one. Until it underflows the object just idles.
 *   2. On the tick it underflows: reload the timer, step the position counter (+3) UP by one
 *      — one pixel DOWN the screen — and mirror the new counter into the object's on-screen
 *      sprite cell (publish50mObjectYToSprite, which routes it to one of two slots by the
 *      pointer's bit 3). When the counter reaches the bottom of its travel (120 = 0x78, its
 *      maximum and so its lowest point on screen), advance the object's state (+0).
 *   3. Hit-test Mario against the object's column (+2). On a miss the shared "no hit" tail
 *      unwinds two levels up (back to the grandparent), so the climb-settle below is skipped
 *      — reproduced by the boolean caller-skip `if (!hit) return;`.
 *   4. On a hit, settle Mario's climb DOWNWARD: while he is still ABOVE the settle line —
 *      his screen Y numerically below 104, and smaller Y is higher — or on an odd pixel row,
 *      keep stepping him down one pixel held in the climb pose. Once his Y has reached the
 *      line (that row or lower on screen) on an even row, publish the climb-centring toggle
 *      from bit 1 of his screen Y (it alternates 0/1 as he climbs).
 *
 * ORACLE BOUNDARY: the oracle passes the record base on the stack; here it is an honest
 * parameter, because dispatch50mObjectState calls this arm directly with it. The hit test
 * still reads its target through a pointer register, so this arm loads that register with the
 * +2 address right before calling it (the same marshalling the oracle's `call` site does);
 * that last piece dissolves once the hit test takes an argument.
 *
 * NAME: promoted from loc_2259 in understanding pass 15 (proposer != confirmer; both
 * derivations independently said DOWN THE SCREEN). The corroboration is OUTSIDE the
 * routine (R5). The
 * screen direction is MEASURED, not inferred from the counter's sign: the sprite-blanking A/B
 * fixed `screen_top = Y - 8` with larger record-Y lower on the displayed screen, and this
 * record's +3 tracked its sprite's Y cell on 6810/6810 board-2 frames of RUN-P2 (a poked 50m
 * board) — so the +3 `inc` this arm performs (0x68 -> 0x78) is the object travelling down.
 * ★ Read that as the identity, NOT as a same-frame equality. The convention source —
 * raise50mObjectAndPark.js's VERTICAL CONVENTION block — records the record-to-sprite identity
 * as LAGGED: +3 at frame N equals the sprite cell at N+1 on 7408/7409, while the exact
 * same-frame form holds on only 7009/7410, because the sprite buffer reflects the record as of
 * the previous frame at that run's sampling point. The state timing corroborates
 * from a sibling: state 1 lasts 122-124 frames against state 3's exactly-68, which the reload
 * constants 4 (here) and 2 (raise50mObjectAndPark) predict. Its callees are named and grounded
 * — publish50mObjectYToSprite, marioReachedTargetColumn, and stepMarioDownInClimbPose (whose
 * "one pixel" name was re-confirmed this pass, 33/33 dispatches writing MARIO_Y exactly once).
 * The Mario half was driven two-sidedly under MAME: Y=108 wrote the toggle 0 on 125/125, Y=110
 * wrote 1 on 47/47, and 113 descend-steps ran with Y pinned at 0x60.
 *
 * WHAT THE NAME DOES NOT CLAIM: "object" again. The sprite is isolated and reads as a ladder
 * graphic, and pass 15's blind confirmer named this cluster for a moving ladder; what stays
 * open is which member of the 50m cast it is. "Slide" is chosen over "extend/retract" on the
 * same evidence — what was measured is a 16-px travel, not a change of length.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2259.test.js.
 * GATE:     crafted-entry, factored. The 50m board gate in dispatch50mObjectState is closed in
 *           attract, so this arm never dispatches there (0 natural in 2000 frames, since
 *           reconfirmed at 0 across 24,243) and no real capture was available when this gate
 *           was built. ★ That is now a coverage HOLE rather than an impossibility: the pass-14
 *           grounding has since driven a natural 50m board (294 body passes) and steered all
 *           three of this arm's write sites, and this gate replays none of it. What it does
 *           prove: the observable space factors into the object tick (swept over all 256 timer
 *           values and all 256 counter positions on both records, with Mario held in a
 *           hit-test miss so only the tick fires) and the climb-settle (Mario pinned to a hit,
 *           swept over every screen-Y decision — above/at the settle line, odd/even row). The
 *           RAM diff excludes the dead STACK_SCRATCH the oracle's dissolved call brackets
 *           (mirror, hit test, descend) write. Teeth: a counter-goes-down twin, a wrong state
 *           threshold twin, a dropped-descend twin, and a wrong-toggle-bit twin.
 * LIVE-OUT: memory-only — the record's timer (+4), counter (+3) and, at the bottom of travel,
 *           state (+0); the mirrored sprite cell; and on the climb-settle either the descended
 *           Mario position/pose bytes or the 0x6222 toggle. The dispatcher discards any register
 *           result; the oracle's residual registers/flags, its terminal return, and the
 *           two-level hit-test skip are dead — the JS call stack and the boolean carry it.
 * NAMES:    MARIO_Y (0x6205), BOARD_OBJ_SCRATCH (0x6280 — the record base is one of its
 *           records) from names.js. publish50mObjectYToSprite (ROM 0x22BD, mirror),
 *           marioReachedTargetColumn (ROM 0x2243, hit test) and stepMarioDownInClimbPose
 *           (ROM 0x2281, descend) are all direct-called. The +0/+2/+3/+4 fields are addressed
 *           relative to the passed-in record base (no fixed cell); 0x6222 is
 *           examined-and-unnamed in names.js (a shared climb-centring toggle), so it stays a
 *           local hex const.
 */

import { MARIO_Y } from "./names.js";
import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js"; // ROM 0x22BD — mirror the counter to the sprite cell
import { marioReachedTargetColumn } from "./marioReachedTargetColumn.js"; // ROM 0x2243 — has Mario reached the target column?
import { stepMarioDownInClimbPose } from "./stepMarioDownInClimbPose.js"; // ROM 0x2281 — step Mario down one pixel in the climb pose

// The counter's maximum — the object's LOWEST point on screen (larger Y is lower). When the
// stepped position reaches it, the object advances its state byte; the mirror of
// raise50mObjectAndPark resetting at the counter's minimum, its highest point.
const COUNTER_BOTTOM = 120;
// The timer's reload value, written on the tick it underflows.
const TIMER_RELOAD = 4;
// The climb's settle line, as a screen Y. While Mario's Y is numerically SMALLER than this
// he is still ABOVE the line on screen (larger Y = lower), so the climb keeps stepping him
// DOWN; once his Y has reached the line (that row or lower) on an even row, it has settled.
const CENTRING_BAND = 104;
// A shared climb-centring toggle — examined and left unnamed in names.js (two writers,
// no absolute reader that settles it), so it stays a local hex const.
const CLIMB_CENTRING_TOGGLE = 0x6222;

/**
 * @param {object} m          the machine.
 * @param {number} recordBase base pointer of the object's record (a BOARD_OBJ_SCRATCH
 *                            record — 0x6280 or 0x6288), passed in by dispatch50mObjectState.
 * @returns {void}
 */
export function slide50mObjectDown(m, recordBase) {
  const { regs, mem } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only
  // the low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  // Field +4 — per-tick timer. Step it down every tick; idle until it underflows.
  const timer = (mem.read8(field(4)) - 1) & 0xff;
  mem.write8(field(4), timer);
  if (timer !== 0) return;

  // Underflowed: reload the timer and step the position counter (+3) UP by one — which moves
  // the object one pixel DOWN the screen.
  mem.write8(field(4), TIMER_RELOAD);
  const counter = (mem.read8(field(3)) + 1) & 0xff;
  mem.write8(field(3), counter);

  // Mirror the new counter into this object's on-screen sprite position cell.
  publish50mObjectYToSprite(m, field(3));

  // Reached the bottom of travel — the counter's maximum, its lowest point on screen:
  // advance the object's state (+0).
  if (counter === COUNTER_BOTTOM) {
    mem.write8(field(0), mem.read8(field(0)) + 1);
  }

  // Is Mario standing on this object's column (+2)? On a miss the shared caller-skip
  // unwinds two levels, so the climb-settle below is skipped.
  regs.hl = field(2);
  if (!marioReachedTargetColumn(m)) return;

  // On the column: settle Mario's climb downward. While he is still above the settle line
  // (his Y numerically below it — smaller Y is higher on screen), or on an odd pixel row,
  // keep stepping him down one pixel held in the climb pose.
  const marioY = mem.read8(MARIO_Y);
  if (marioY < CENTRING_BAND || (marioY & 1) !== 0) {
    stepMarioDownInClimbPose(m);
    return;
  }

  // Settled — at or past the line on screen, on an even row: publish the climb-centring
  // toggle from bit 1 of his screen Y, so it alternates as he climbs.
  mem.write8(CLIMB_CENTRING_TOGGLE, (marioY >> 1) & 1);
}
