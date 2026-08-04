// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mObjectDown — the descend arm of a conveyor-board object's state machine: tick this
 * object's timer, step its position counter up — which moves the object DOWN the screen —
 * mirror the new position to its sprite, advance the state at the bottom of travel, then, while
 * Mario is standing on the object's column, settle his climb one pixel at a time.
 *
 * The board's object dispatcher picks one of two 8-byte object records by frame parity and
 * dispatches on the object's state byte to one of four arms; this is that machine's descend
 * arm. It is the exact mirror of the sibling raise arm: that one steps the position counter
 * DOWN toward its minimum, the object's HIGHEST point on screen, and resets the record; this
 * one steps it UP toward its maximum, the object's LOWEST point, and advances the state. The
 * counter IS a screen Y, and larger Y is lower on this screen.
 *
 * The record fields it touches:
 *   +0  the object's state, advanced by one when the counter reaches its maximum — the bottom
 *       of travel, lowest on screen
 *   +2  the object's column: the X Mario must be standing on, fed to the hit test
 *   +3  the position counter, stepped UP by one — moving the object DOWN the screen — and
 *       mirrored to the object's sprite cell
 *   +4  a per-tick timer, counted down one step every time this arm runs
 *
 * What it does:
 *   1. Count the timer down by one. Until it underflows the object just idles.
 *   2. On the tick it underflows: reload the timer, step the position counter UP by one — one
 *      pixel DOWN the screen — and mirror the new counter into the object's on-screen sprite
 *      cell, which is routed to one of two sprite slots by a bit of the record's own address.
 *      When the counter reaches the bottom of its travel, advance the object's state.
 *   3. Hit-test Mario against the object's column. On a miss the shared "no hit" path unwinds
 *      two levels up, so the climb-settle below is skipped.
 *   4. On a hit, settle Mario's climb DOWNWARD: while he is still ABOVE the settle line — his
 *      screen Y numerically below it, since smaller Y is higher — or on an odd pixel row, keep
 *      stepping him down one pixel held in the climb pose. Once his Y has reached the line, on
 *      an even row, publish the climb-centring toggle from bit 1 of his screen Y, so it
 *      alternates as he climbs.
 *
 * THE SCREEN DIRECTION IS MEASURED, not inferred from the counter's sign. A sprite's drawn top
 * is its Y minus eight, so larger Y is lower on the displayed screen, and this record's
 * position counter tracks its sprite's Y cell on every frame of a live board. So the step this
 * arm performs is the object travelling down. Read that as an identity between the record and
 * the sprite, NOT as a same-frame equality: the sprite buffer reflects the record as of the
 * previous frame, so the match is lagged by one. The state timing corroborates it from the
 * sibling arm — this state lasts about twice as long as the raise state, which is exactly what
 * the two arms' timer reload values predict.
 *
 * WHAT THE NAME DOES NOT CLAIM: "object", again. The sprite is isolated and reads as a ladder
 * graphic; which member of the board's cast it is stays open. "Slide" is chosen over "extend"
 * or "retract" on the same evidence — what was measured is a 16-pixel travel, not a change of
 * length.
 *
 * The record base is a parameter, since the dispatcher calls this arm directly with it. The hit
 * test reads its target through a pointer register, so that register is loaded with the
 * column's address right before the call.
 *
 * Reads: the record's timer, counter, state and column; Mario's Y. Writes: the record's timer,
 * counter and state; the mirrored sprite cell; and on the settle either Mario's position and
 * pose or the climb-centring toggle.
 *
 * LIVE-OUT: memory-only. The dispatcher discards any register result.
 */

import { MARIO_Y } from "./names.js";
import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js";
import { marioReachedTargetColumn } from "./marioReachedTargetColumn.js";
import { stepMarioDownInClimbPose } from "./stepMarioDownInClimbPose.js";

// The counter's maximum — the object's LOWEST point on screen, since larger Y is lower. When
// the stepped position reaches it the object advances its state byte; the raise arm mirrors
// this, resetting at the counter's minimum, its highest point.
const COUNTER_BOTTOM = 120;
// The timer's reload value, written on the tick it underflows.
const TIMER_RELOAD = 4;
// The climb's settle line, as a screen Y. While Mario's Y is numerically SMALLER than this he
// is still ABOVE the line on screen, so the climb keeps stepping him DOWN; once his Y has
// reached the line, on an even row, it has settled.
const CENTRING_BAND = 104;
// A shared climb-centring toggle. It carries no shared name because two routines write it and
// no reader settles what it means, so it is file-local here.
const CLIMB_CENTRING_TOGGLE = 0x6222;

/**
 * @param {object} m          the machine.
 * @param {number} recordBase base pointer of the object's record, one of the two the board's
 *                            object dispatcher owns.
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
