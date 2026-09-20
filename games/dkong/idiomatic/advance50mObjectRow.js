// SPDX-License-Identifier: GPL-3.0-only
/**
 * advance50mObjectRow — advance and edge-cull the six-record 50m moving-object row. Each active
 * record steps its X by the appropriate step shadow (the center-split mover moves toward the near
 * half and dies at dead center; the plain mover steps by the object-3 shadow), and any record that
 * runs within seven pixels of the left edge is culled — its active flag, X, and sprite record cleared.
 *
 * LIVE-OUT: memory + DE (the record stride, reused by the caller as its pointer increment).
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_ARRAY_65A0,
  M50_OBJ2_STEP_POS,
  M50_OBJ2_STEP_NEG,
  M50_OBJ3_STEP,
  OBJ_65A0_SPRITES,} from "./names.js";

const SLOT_COUNT = 6;
const SLOT_STRIDE = 0x10;      // object-record stride; also the DE live-out value
const FIELD_ACTIVE = 0x00;     // +0: activity flags
const ACTIVE_BIT = 0x01;       // +0 bit0: record is live
const FIELD_X = 0x03;          // +3: object X position (the coordinate this routine steps)
const FIELD_MOVER = 0x05;      // +5: mover selector (0x7c -> center-split mover, else plain)
const CENTER_SPLIT_MOVER = 0x7c; // field +5 sentinel for the center-split object (object-2)
const CENTER_X = 0x80;         // midpoint of the 0..255 X range; the center-split object dies here
const CULL_SPRITE_STRIDE = 0x04; // four bytes per sprite record

export function advance50mObjectRow(m) {
  const { mem8 } = m;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;

    if ((mem8[slot + FIELD_ACTIVE] & ACTIVE_BIT) === 0) continue;

    const x = mem8[slot + FIELD_X];
    let cull = false;

    if (u8(x + 0x07) < 0x0e) {
      cull = true;
    } else if (mem8[slot + FIELD_MOVER] === CENTER_SPLIT_MOVER) {
      if (x === CENTER_X) {
        cull = true;
      } else {
        const step = x > CENTER_X
          ? mem8[M50_OBJ2_STEP_POS]  // right half — the +step shadow
          : mem8[M50_OBJ2_STEP_NEG]; // left half — the -step shadow
        mem8[slot + FIELD_X] = x + step;
      }
    } else {
      mem8[slot + FIELD_X] = x + mem8[M50_OBJ3_STEP];
    }

    if (cull) {
      mem8[slot + FIELD_ACTIVE] = 0;
      mem8[slot + FIELD_X] = 0;
      mem8[OBJ_65A0_SPRITES + CULL_SPRITE_STRIDE * i] = 0;
    }
  }

  return (m.regs.de = SLOT_STRIDE); // LIVE-OUT: record stride, caller's pointer increment
}
