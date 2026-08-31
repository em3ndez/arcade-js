// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_PARAM_68EF } from "./names.js";

const PHASE_FIELD = 0x02; // record phase byte
const SUBPOS_A = 0x03; // sub-position field cleared to zero
const SUBPOS_B = 0x05; // sub-position field cleared to zero
const FIELD_04 = 0x04; // seated to 0x08
const FIELD_06 = 0x06; // seated to 0x1e
const FIELD_09 = 0x09; // seated to 0x18 after the animation is armed

/**
 * advanceObjectToNextStateAndArmAnim — advance an object to its next state: bump the phase, zero its two sub-position
 * fields, seat two fixed field values, arm its animation from the state parameter block,
 * then seat one more field.
 *
 * LIVE-OUT: memory only — the record fields and its animation pointer.
 */
export function advanceObjectToNextStateAndArmAnim(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + PHASE_FIELD] = mem8[rec + PHASE_FIELD] + 1;
  mem8[rec + SUBPOS_A] = 0x00;
  mem8[rec + SUBPOS_B] = 0x00;
  mem8[rec + FIELD_04] = 0x08;
  mem8[rec + FIELD_06] = 0x1e;
  setActorAnimation(m, rec, ANIM_PARAM_68EF);
  mem8[rec + FIELD_09] = 0x18;
}
