// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireBarrelIntoOilDrum — retire a barrel that has reached the bottom of the playfield inside the
 * oil drum's column band: free its slot, blank its column, sound the impact, arm two mode flags,
 * and hand the record to the shared sprite publish INSTEAD OF returning to the caller.
 *
 * Three gates in a row, each of which returns and leaves everything alone:
 *   - the record's OBJ_Y must have reached BOTTOM_ROW. Larger Y is LOWER on this screen, so that
 *     is near the bottom of a 256-row frame.
 *   - its OBJ_X must lie inside the column band. Both ends are tested against the SAME byte, so
 *     the band is a range test, not two independent limits.
 * Past all of them the barrel is retired: OBJ_ACTIVE and OBJ_X are both zeroed — the slot freed
 * and the column blanked — the impact sound latch is asserted for three frames, and control leaves
 * for good.
 *
 * TWO MODE FLAGS ARE ARMED HERE, and they are the reason this routine is more than a bounds check.
 * Both are latches other routines read, not values this one consumes:
 *   - only for a barrel whose kind field is non-zero, PHASE_BITS is set to bit0|bit1 — the pair
 *     that lets the fixed-hazard machine keep running AND take its second arm, the arm that runs a
 *     countdown and eventually raises the object-insert request. So retiring one kind of barrel is
 *     what ARMS a fire release; the fire itself is spawned later, and subject to a live-count cap.
 *   - MODE_LATCH is set to 1 the first time this ever fires, and never touched again while it
 *     stays set. Its readers both take CLEAR as the simple early-game behaviour and SET as the
 *     difficulty-graded one, so setting it here is a one-way switch into the graded behaviour.
 *
 * NOT CLAIMED: which physical screen edge the column band sits at, and why the kind field selects
 * the phase write.
 *
 * THE RETURN IS A PROTOCOL, not a value. On the retirement arm the caller's return address is
 * taken off the stack here and control is handed to the shared sprite publish, so it never comes
 * back and the caller's remaining code must not run. All three callers already obey that by
 * guarding the call. `false` means "retired, control has left"; `true` means "returned normally,
 * carry on".
 *
 * The record base arrives in the index register and is deliberately NOT a parameter: the shared
 * publish reads the record straight off that register, so a caller passing a different base would
 * be obeyed by the writes here and ignored one hand-off later.
 *
 * Reads: the record's OBJ_Y, OBJ_X and kind field; MODE_LATCH.
 * Writes: the record's OBJ_ACTIVE and OBJ_X; PHASE_BITS (kind arm only); the impact sound latch;
 * MODE_LATCH (first firing only).
 *
 * LIVE-OUT: the protocol value, and nothing else.
 */

import { OBJ_ACTIVE, OBJ_X, OBJ_Y, SND_TRIGGER } from "./names.js";

/**
 * Barrel-record kind flag (+0x15) — 0 for the default kind, 1 for the alternate kind, which is
 * stamped at release alongside a different sprite code and attribute. Scoped to this file rather
 * than given a shared OBJ_* name, because offset 0x15 carries an unrelated role on other record
 * arrays, where it is down-counted as a frame timer.
 */
const OBJ_KIND = 0x15;

/** A Y of this or more counts as having reached the bottom — larger Y is lower on this screen. */
const BOTTOM_ROW = 232;
/** The column band, inclusive of the low end and exclusive of the high one. */
const BAND_LO = 32;
const BAND_HI = 42;

/** Three-frame assert on the impact sound latch. */
const IMPACT_SOUND = SND_TRIGGER + 2;
const SOUND_FRAMES = 3;

/**
 * The phase byte the fixed-hazard machine dispatches on. It carries no shared name — four
 * unrelated routines write it and one reads it — so it is file-local here. Bit 0 SET lets that
 * machine's body run at all; bit 1 selects its second arm, the one that runs a countdown and,
 * on its underflow, raises the object-insert request.
 */
const PHASE_BITS = 0x62b9;
const PHASE_CONTINUE = 1;
const PHASE_SECOND_ARM = 2;

/**
 * The one-shot mode latch. It carries no shared name because it is multiplexed: one reader takes
 * it as the object-velocity mode, another as a spawn gate. Both take CLEAR as the simple
 * early-game behaviour, so setting it here is a one-way switch into the graded behaviour.
 */
const MODE_LATCH = 0x6348;

/**
 * @param {object} m  the machine; the record base is read from its index register.
 * @returns {boolean} true when control returned to the caller normally; false when the barrel
 *   was retired and control was handed to the shared sprite publish, so the caller's remaining
 *   code must not run.
 */
export function retireBarrelIntoOilDrum(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  if (mem8[record + OBJ_Y] < BOTTOM_ROW) return true;

  const column = mem8[record + OBJ_X];
  if (column >= BAND_HI) return true;
  if (column < BAND_LO) return true;

  // Only the alternate kind arms the phase byte, and it does so before the record is torn down.
  if (mem8[record + OBJ_KIND] !== 0) mem8[PHASE_BITS] = PHASE_CONTINUE | PHASE_SECOND_ARM;

  // Retire the slot and blank the column it died in, then sound the impact.
  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  mem8[IMPACT_SOUND] = SOUND_FRAMES;

  // The caller's return address comes off the stack: control is not going back there. The word
  // is handed on rather than thrown away — the publish banks the register set on entry, so it
  // lands in the alternate bank. It is kept because the hardware sequence keeps it, not because
  // a reader for it was found.
  m.regs.hl = m.pop16();

  // The one-shot: armed on the first retirement and left alone on every later one.
  if (mem8[MODE_LATCH] === 0) mem8[MODE_LATCH] = 1;

  // The shared sprite publish writes out the record just torn down and carries the walk on.
  m.call(0x21ba);
  return false;
}
