// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_33ca } from "./loc_33ca.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  EAGLE_TARGET_COLUMN_BIAS,
  STAGE_COUNTDOWN,
  SPAWN_ACTIVE_FLAG,
  ANIM_TABLE_3847,
  ANIM_TABLE_3856,
} from "./names.js";
/**
 * loc_33bd — enemy-actor state-0 handler for the record based at IX. Counts down the state timer
 * (rec+0x11); until it expires it does nothing. On expiry it advances the animation frame (rec+0x02)
 * and branches on bit0 of the flap byte (rec+0x0b): clear falls into the shared turn-select tail; set
 * runs the flap-reset arm — bump the eagle target-column bias, re-latch the stage countdown to 6,
 * clear the spawn active flag and the flap byte, re-run the turn-select tail, then install the flap
 * sprite table picked by bit0 of the turn-select result (rec+0x08).
 *
 * LIVE-OUT: none — memory only; the record-dispatch caller reloads A and reads no register back.
 */
const OFF_FRAME = 0x02; //  animation frame counter, bumped on timer expiry
const OFF_SPRITE = 0x08; // turn-select result; bit0 picks the flap table
const OFF_FLAP = 0x0b; //   bit0 selects the flap-reset arm
const OFF_TIMER = 0x11; //  state countdown
const FLAP_RESET_COUNTDOWN = 0x06; // stage countdown re-latched on the flap-reset arm

export function loc_33bd(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[u16(rec + OFF_TIMER)] = mem8[u16(rec + OFF_TIMER)] - 1; // tick the state timer
  if (mem8[u16(rec + OFF_TIMER)] !== 0) return; //               still counting -> idle

  mem8[u16(rec + OFF_FRAME)] = mem8[u16(rec + OFF_FRAME)] + 1; // advance the frame

  if ((mem8[u16(rec + OFF_FLAP)] & 0x01) === 0) {
    return loc_33ca(m, rec); // fall into the shared turn-select tail
  }

  // Flap-reset arm.
  mem8[EAGLE_TARGET_COLUMN_BIAS] = mem8[EAGLE_TARGET_COLUMN_BIAS] + 1;
  mem8[STAGE_COUNTDOWN] = FLAP_RESET_COUNTDOWN;
  mem8[SPAWN_ACTIVE_FLAG] = 0x00;
  mem8[u16(rec + OFF_FLAP)] = 0x00;
  loc_33ca(m, rec); // re-run the turn-select tail (return-slot push dropped)
  const flapTable = mem8[u16(rec + OFF_SPRITE)] & 0x01 ? ANIM_TABLE_3856 : ANIM_TABLE_3847;
  return setActorAnimation(m, rec, flapTable);
}
