// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireBarrelIntoOilDrum — retire a barrel that has reached the bottom of the playfield inside the
 * oil drum's column band, then hand the record to the shared sprite publish instead of returning.
 * Three gates each return true and leave everything alone: OBJ_Y must have reached BOTTOM_ROW
 * (larger Y is lower), and OBJ_X must lie inside the column band. Past them the slot is freed
 * (OBJ_ACTIVE, OBJ_X zeroed), the impact sound is asserted, and two latches are armed: the alternate
 * kind sets FIXED_HAZARD_PHASE to arm a later fire release, and BARREL_DIFFICULTY_LATCH one-way-switches into the
 * difficulty-graded behaviour on the first firing. The record base arrives in the index register,
 * not as a parameter. Returns false when retired (control has left; caller's remaining code must not
 * run), true when it returned normally.
 *
 * LIVE-OUT: the protocol value, and nothing else.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import {
  BARREL_DIFFICULTY_LATCH,
  FIXED_HAZARD_PHASE,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  SND_TRIGGER,
} from "./names.js";

// Barrel-record kind flag: 0 default, 1 alternate. File-local because offset 0x15 is a frame timer
// on other record arrays, so it must not get a shared OBJ_* name.
const OBJ_KIND = 0x15;

const BOTTOM_ROW = 232;
// Column band: inclusive low, exclusive high.
const BAND_LO = 32;
const BAND_HI = 42;

const IMPACT_SOUND = SND_TRIGGER + 2;
const SOUND_FRAMES = 3;

// Phase byte the fixed-hazard machine dispatches on. Bit 0 lets its body run; bit 1
// selects the second arm, whose countdown underflow raises the object-insert request.
const PHASE_CONTINUE = 1;
const PHASE_SECOND_ARM = 2;

// One-shot mode latch, multiplexed (object-velocity mode / spawn gate), so file-local.

export function retireBarrelIntoOilDrum(m, ix = m.regs.ix) {
  const { mem8 } = m;
  const record = ix;

  if (mem8[record + OBJ_Y] < BOTTOM_ROW) return true;

  const column = mem8[record + OBJ_X];
  if (column >= BAND_HI) return true;
  if (column < BAND_LO) return true;

  // Only the alternate kind arms the phase byte, and it does so before the record is torn down.
  if (mem8[record + OBJ_KIND] !== 0) mem8[FIXED_HAZARD_PHASE] = PHASE_CONTINUE | PHASE_SECOND_ARM;

  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  mem8[IMPACT_SOUND] = SOUND_FRAMES;

  if (mem8[BARREL_DIFFICULTY_LATCH] === 0) mem8[BARREL_DIFFICULTY_LATCH] = 1;

  publishBarrelSprite(m);
  return false;
}
