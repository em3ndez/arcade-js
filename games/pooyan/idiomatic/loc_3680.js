// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_36de } from "./loc_36de.js";
import { loc_379d } from "./loc_379d.js";
import {
  SLOT_SPAWN_INDEX,
  ACTIVE_LANE_COUNT,
  LANE_SPAWN_COUNTDOWN,
  loc_8d76,
  ANIM_FRAME_COUNTER,
  ANIM_SEQ_3988,
  ANIM_SEQ_3994,
} from "./names.js";
/**
 * loc_3680 — find a free actor slot in the IY table and spawn into the IX template.
 *
 * Scans B entries at stride DE for the first slot whose +0/+1 pair has bit0 clear; the table
 * being full returns with no spawn. On a hit it bumps the spawn counters (the slot index always;
 * the lane count and its countdown only while the template's +7 bit2 is set and lanes remain),
 * steps the frame counter (skipping 0 on wrap) into the template's +14, seats the anim vector
 * (+0c/+0d) chosen by +7 bit1 plus the fixed +0e/+11/+02 fields, builds the attribute byte, then
 * tail-hands to the slot initialiser.
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. The
 * hit path forwards the tail initialiser's A as a harmless value result; the full path sets nothing.
 */

const SPAWN_TIMER = 0x28; // template +0x11

export function loc_3680(m, base = m.regs.iy, stride = m.regs.de, count = m.regs.b, template = m.regs.ix) {
  const { mem8 } = m;

  let slot = base;
  let remaining = count & 0xff;
  let found = false;
  for (;;) {
    if (((mem8[slot + 0x00] | mem8[slot + 0x01]) & 0x01) === 0) { found = true; break; }
    slot = u16(slot + stride);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break; // table full -- no slot
  }
  if (!found) return; // table full

  if ((mem8[template + 0x07] & 0x04) !== 0) { // +7 bit2 armed
    mem8[SLOT_SPAWN_INDEX] = mem8[SLOT_SPAWN_INDEX] + 1;
    const lanes = mem8[ACTIVE_LANE_COUNT];
    if (lanes !== 0) {
      mem8[ACTIVE_LANE_COUNT] = lanes - 1;
      mem8[LANE_SPAWN_COUNTDOWN] = lanes; // pre-decrement lane count
      mem8[loc_8d76] = 0x00;
    }
  }

  let frameId = (mem8[ANIM_FRAME_COUNTER] + 1) & 0xff;
  if (frameId === 0) frameId = 0x01; // wrapped to 0 -> skip it
  mem8[ANIM_FRAME_COUNTER] = frameId;
  mem8[template + 0x14] = frameId;

  const animVector = (mem8[template + 0x07] & 0x02) !== 0 ? ANIM_SEQ_3994 : ANIM_SEQ_3988;
  mem8[template + 0x0c] = animVector; //               little-endian vector, low byte
  mem8[template + 0x0d] = (animVector >> 8); //         ...high byte
  mem8[template + 0x0e] = 0x00;
  mem8[template + 0x11] = SPAWN_TIMER;
  mem8[template + 0x02] = 0x04;

  loc_36de(m, template); // build the attribute byte at +0x08
  return loc_379d(m, slot, template, frameId); // tail: initialise the found slot
}
