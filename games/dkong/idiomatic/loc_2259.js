// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2259 — one arm of the sub_2207 board-object state machine: tick this object's
 * timer, step its position counter UP and mirror it on-screen, advance its state at the
 * top of travel, then — once Mario has reached the object's target column — settle his
 * climb one pixel at a time.  ROM 0x2259.
 *
 * sub_2207 selects one of two 8-byte board-object records by frame parity, pushes the
 * record base, and dispatches on the object's state byte to one of a few arms; this is
 * one such arm. It is the UP mirror of the sibling arm loc_22a2: where loc_22a2 steps the
 * position counter DOWN toward its bottom and resets the record, this arm steps it UP
 * toward its top and advances the state. The record fields it touches:
 *   +0  the object's state (advanced by one when the counter reaches the top)
 *   +2  the object's target column — the X Mario must reach (fed to the hit test)
 *   +3  the position counter, stepped UP by one and mirrored to the object's sprite cell
 *   +4  a per-tick timer, counted down one step every time this arm runs
 *
 * What it does:
 *   1. Count the timer (+4) down by one. Until it underflows the object just idles.
 *   2. On the tick it underflows: reload the timer, step the position counter (+3) UP by
 *      one, and mirror the new counter into the object's on-screen sprite cell (loc_22bd,
 *      which routes it to one of two slots by the pointer's bit 3). When the counter
 *      reaches the top of its travel (120), advance the object's state (+0).
 *   3. Hit-test Mario against the object's target column (+2). On a miss the shared "no
 *      hit" tail unwinds two levels up (back to the grandparent), so the climb-settle
 *      below is skipped — reproduced by the boolean caller-skip `if (!hit) return;`.
 *   4. On a hit, settle Mario's climb: while he is below the centring band or on an odd
 *      pixel row, keep stepping him down one pixel held in the climb-down pose; once he is
 *      on an even row inside the band, publish the climb-centring toggle from bit 1 of his
 *      screen Y (it alternates 0/1 as he climbs).
 *
 * ORACLE BOUNDARY: the record base arrives on the stack, pushed by sub_2207 — still the
 * frozen lift — so it is received as a parameter here (the lift's entry pop). Likewise the
 * hit test still reads its target through a pointer register, so this arm loads that
 * register with the +2 address right before calling it (the same marshalling the lift's
 * `call` site does); both dissolve fully once sub_2207 is brought across.
 *
 * NAME: kept the neutral loc_ — the timer/counter/hit-test/climb-settle mechanics are
 * pinned to the oracle and it is the confirmed UP mirror of loc_22a2, but which board
 * object this arm services (and what its sprite markers and the 0x6222 toggle mean) is not
 * corroborated to the routine-name bar, matching its siblings loc_22a2 / loc_2227.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2259.test.js.
 * GATE:     crafted-entry, factored. sub_2207's board gate is closed in attract, so this
 *           arm never dispatches there (0 natural in 2000 frames) and real captures are
 *           unavailable; the observable space factors into the object tick (swept over all
 *           256 timer values and all 256 counter positions on both records, with Mario held
 *           in a hit-test miss so only the tick fires) and the climb-settle (Mario pinned to
 *           a hit, swept over every screen-Y decision — below/inside the band, odd/even). The
 *           RAM diff excludes the dead STACK_SCRATCH the oracle's dissolved call brackets
 *           (mirror, hit test, descend) write. Teeth: a counter-goes-down twin, a wrong state
 *           threshold twin, a dropped-descend twin, and a wrong-toggle-bit twin.
 * LIVE-OUT: memory-only — the record's timer (+4), counter (+3) and (at the top) state (+0),
 *           the mirrored sprite cell, and on the climb-settle either the descended Mario
 *           position/pose bytes or the 0x6222 toggle. The dispatcher discards any register
 *           result; the oracle's residual registers/flags, its terminal return, and the
 *           two-level hit-test skip are dead — the JS call stack and the boolean carry it.
 * NAMES:    MARIO_Y (0x6205), BOARD_OBJ_SCRATCH (0x6280 — the record base is one of its
 *           records) from ram.js. loc_22bd (ROM 0x22BD, mirror), marioReachedTargetColumn
 *           (ROM 0x2243, hit test), stepMarioDownInClimbPose (ROM 0x2284, descend) are all
 *           direct-called. The +0/+2/+3/+4 fields are addressed relative to the passed-in
 *           record base (no fixed cell); 0x6222 is examined-and-unnamed in ram.js (a shared
 *           climb-centring toggle), so it stays a local hex const.
 */

import { MARIO_Y } from "./ram.js";
import { loc_22bd } from "./loc_22bd.js"; // ROM 0x22BD — mirror the counter to the sprite cell
import { marioReachedTargetColumn } from "./marioReachedTargetColumn.js"; // ROM 0x2243 — has Mario reached the target column?
import { stepMarioDownInClimbPose } from "./stepMarioDownInClimbPose.js"; // ROM 0x2284 — step Mario down one pixel in the climb pose

// The counter's top of travel: when the stepped position reaches it, the object advances
// its state byte (mirror of loc_22a2 resetting at its bottom).
const COUNTER_TOP = 120;
// The timer's reload value, written on the tick it underflows.
const TIMER_RELOAD = 4;
// Mario's screen Y below which the climb keeps stepping him down (larger Y = lower on
// screen); at or above it, on an even row, the climb has settled.
const CENTRING_BAND = 104;
// A shared climb-centring toggle — examined and left unnamed in ram.js (two writers,
// no absolute reader that settles it), so it stays a local hex const.
const CLIMB_CENTRING_TOGGLE = 0x6222;

/**
 * @param {object} m          the machine.
 * @param {number} recordBase base pointer of the object's record (a BOARD_OBJ_SCRATCH
 *                            record — 0x6280 or 0x6288), pushed by the still-frozen sub_2207.
 * @returns {void}
 */
export function loc_2259(m, recordBase) {
  const { regs, mem } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only
  // the low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  // Field +4 — per-tick timer. Step it down every tick; idle until it underflows.
  const timer = (mem.read8(field(4)) - 1) & 0xff;
  mem.write8(field(4), timer);
  if (timer !== 0) return;

  // Underflowed: reload the timer and step the position counter (+3) UP by one.
  mem.write8(field(4), TIMER_RELOAD);
  const counter = (mem.read8(field(3)) + 1) & 0xff;
  mem.write8(field(3), counter);

  // Mirror the new counter into this object's on-screen sprite position cell.
  loc_22bd(m, field(3));

  // Reached the top of travel: advance the object's state (+0).
  if (counter === COUNTER_TOP) {
    mem.write8(field(0), mem.read8(field(0)) + 1);
  }

  // Has Mario reached this object's target column (+2)? On a miss the shared caller-skip
  // unwinds two levels, so the climb-settle below is skipped.
  regs.hl = field(2);
  if (!marioReachedTargetColumn(m)) return;

  // Reached: settle Mario's climb. Below the centring band, or on an odd pixel row, keep
  // stepping him down one pixel held in the climb-down pose until he lands on an even row
  // inside the band.
  const marioY = mem.read8(MARIO_Y);
  if (marioY < CENTRING_BAND || (marioY & 1) !== 0) {
    stepMarioDownInClimbPose(m);
    return;
  }

  // Settled on an even row inside the band: publish the climb-centring toggle from bit 1
  // of his screen Y, so it alternates as he climbs.
  mem.write8(CLIMB_CENTRING_TOGGLE, (marioY >> 1) & 1);
}
