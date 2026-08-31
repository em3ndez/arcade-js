// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
/**
 * climbHunterStepAndRetireAtTop — HUNTER DISPATCH STATE 2: climb the hunter one step, and retire it at the top row.
 *
 * ROM 0x2d24–0x2d49.
 *
 * WHAT IT IS.  Pooyan's "hunter" attackers each carry a per-record state byte at field +0x02. Once
 * per frame the hunter dispatcher (dispatchAllHunterRecordStates, 0x2c2c) sweeps the 17 hunter
 * records; for each active record it peels off the low bits of that state byte and selects one of
 * four per-state handlers. THIS routine is the handler for dispatch state 2: the phase in which a
 * hunter is rising up its column toward the top of the play area.
 *
 * WHAT IT DOES.  It advances the record's animation one frame, then integrates the record's 16-bit
 * vertical position upward by its per-frame step. While the hunter has not yet reached the top row it
 * lets the dispatcher's walk continue (returns true). The frame the hunter's high position byte
 * reaches the top row (0x19) it "arrives": it bumps the record to its next dispatch state, zeroes the
 * position and the movement-script field so the next state starts clean, and tells the dispatcher to
 * STOP the rest of this pass over the records (returns false — the caller-skip boolean).
 *
 * The `rec` argument is the base of one hunter record; the records live in the hunter span of the
 * enemy-actor table region (ENEMY_ACTOR_TABLE, 0x8ae0) and are stride 0x18 apart. Fields touched:
 *   +0x02 STATE     — the per-record dispatch state byte the sweep reads.
 *   +0x05/+0x06     — 16-bit vertical position, low byte / high byte (high byte ≈ tile row).
 *   +0x09 POS_STEP  — signed per-frame vertical step added to the position.
 *   +0x16 SCRIPT    — the record's movement/animation script field, cleared on arrival.
 *
 * GROUNDING: names.js carries no cert entry for this routine's own address; the enemy-actor record
 * region it walks (ENEMY_ACTOR_TABLE 0x8ae0) and the dispatcher that reaches it
 * (dispatchAllHunterRecordStates 0x2c2c) are both [seen].
 *
 * LIVE-OUT: the returned boolean — true = keep sweeping the remaining hunter records, false =
 * caller-skip (abort the rest of this dispatch pass). Every other effect is memory.
 */
const POS_LO = 0x05; //   +0x05: low byte of the record's 16-bit vertical position
const POS_HI = 0x06; //   +0x06: high byte of that position (its tile row)
const POS_STEP = 0x09; // +0x09: per-frame vertical step added to the position
const STATE = 0x02; //    +0x02: the per-record dispatch state byte the sweep selects on
const SCRIPT = 0x16; //   +0x16: the record's movement/animation script field
const TOP_ROW = 0x19; //  high position byte at/above which the hunter has reached the top

export function climbHunterStepAndRetireAtTop(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step this record's animation one frame (its frame-hold countdown, then its script walk).
  advanceObjectAnimationFrame(m, rec);

  // Integrate the vertical position upward: add the per-frame step to the low byte, and when the
  // low byte overflows past a full 8-bit value, carry the +1 up into the high (tile-row) byte.
  const low = mem8[rec + POS_LO] + mem8[rec + POS_STEP];
  if (low > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  mem8[rec + POS_LO] = low; // store the low byte back (wraps to 8 bits on write)

  // Still below the top row → the hunter is mid-climb: leave the record in state 2 and let the
  // dispatcher keep sweeping the remaining hunter records.
  if (mem8[rec + POS_HI] < TOP_ROW) return true; // still climbing

  // Reached the top row. Retire this climb phase: advance the record to its next dispatch state,
  // then zero the vertical position and the movement-script field so the next state begins clean.
  mem8[rec + STATE] = mem8[rec + STATE] + 1; // arrival: step to the next dispatch state
  mem8[rec + POS_LO] = 0; // clear position low
  mem8[rec + POS_HI] = 0; // clear position high
  mem8[rec + SCRIPT] = 0; // clear the movement-script field

  // Signal the dispatcher to stop this pass: on the hardware the arrival path drops the caller's
  // saved return before returning, unwinding a level so the per-record walk does not resume. That
  // surfaces here as the caller-skip boolean.
  return false; // caller-skip
}
