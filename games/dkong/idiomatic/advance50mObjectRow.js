// SPDX-License-Identifier: GPL-3.0-only
/**
 * advance50mObjectRow — advance and edge-cull the 50m moving-object row.  ROM 0x2591.
 *
 * Walks the six records of the 50m object array (OBJ_ARRAY_65A0, stride 0x10). Each
 * active record (field +0 bit0 set) has its X position (field +3) stepped horizontally,
 * and is removed the moment it runs off the play area:
 *
 *   - If X sits within seven pixels of the left edge (wrapping through zero) the object
 *     is culled outright, before any step.
 *   - Otherwise field +5 selects the mover. The sentinel value 0x7c picks the
 *     center-split mover: the object steps toward whichever half it is in — the +step
 *     shadow (M50_OBJ2_STEP_POS) on the right half, the -step shadow (M50_OBJ2_STEP_NEG)
 *     on the left half — and is culled if it reaches dead center (X == 0x80). Any other
 *     field +5 uses the plain mover, stepping X by the object-3 shadow (M50_OBJ3_STEP).
 *
 * Culling clears the record's active flag and X and blanks the object's sprite record
 * (four bytes from 0x69B8, indexed by the record's position in the row), so it vanishes
 * from the display. Inactive records are skipped untouched.
 *
 * The step shadows are the signed ±1/0 unit steps the 50m reversal machinery publishes,
 * so this routine is the consumer that actually moves the 50m objects across the screen.
 *
 * Promoted from loc_2591 (DK understanding pass 10, independent proposer≠confirmer, MODERATE-HIGH):
 * it walks OBJ_ARRAY_65A0 (rated, grounded live vs MAME as the 50m horizontally-moving objects)
 * and steps X by the named-and-grounded M50_OBJ2_STEP_POS/NEG and M50_OBJ3_STEP shadows, culling
 * at the edges/center. The object family is grounded and the advance-and-cull role is exactly the name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2591.test.js.
 * GATE:     crafted-entry — a real boot/attract base with the six records + step shadows
 *           poked, since sub_24ea gates this on 50m (board 2) and attract only plays 25m,
 *           so it takes no natural dispatch there. Single-record sweep over all 256 X
 *           values × both movers × representative signed steps covers every arm (left-edge
 *           cull, center cull, right/left step, plain step); a multi-record pass proves the
 *           per-slot sprite-clear index.
 * LIVE-OUT: memory + DE. The stride 0x0010 the oracle leaves in DE is reused as its own IX
 *           increment by the still-oracle caller sub_24ea, so it is a genuine register
 *           live-out at this boundary — set and kept. Residual registers/flags and the
 *           terminal return are dead.
 * NAMES:    OBJ_ARRAY_65A0 (0x65A0), M50_OBJ2_STEP_POS (0x63A5), M50_OBJ2_STEP_NEG
 *           (0x63A4), M50_OBJ3_STEP (0x63A6) — all from ram.js. The per-record sprite
 *           block at 0x69B8 (inside SPRITE_BUFFER, stride 4) is unnamed in ram.js — kept
 *           as a local hex address.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_ARRAY_65A0,
  M50_OBJ2_STEP_POS,
  M50_OBJ2_STEP_NEG,
  M50_OBJ3_STEP,
  OBJ_65A0_SPRITES,} from "./ram.js";

const SLOT_COUNT = 6;
const SLOT_STRIDE = 0x10;      // object-record stride; also the DE live-out value (0x0010)
const FIELD_ACTIVE = 0x00;     // +0: activity flags
const ACTIVE_BIT = 0x01;       // +0 bit0: record is live
const FIELD_X = 0x03;          // +3: object X position (the coordinate this routine steps)
const FIELD_MOVER = 0x05;      // +5: mover selector (0x7c -> center-split mover, else plain)
const CENTER_SPLIT_MOVER = 0x7c; // field +5 sentinel for the center-split object (object-2)
const CENTER_X = 0x80;         // midpoint of the 0..255 X range; the center-split object dies here
const CULL_SPRITE_STRIDE = 0x04; // four bytes per sprite record

/**
 * @param {object} m  the machine (uses m.mem and m.regs.de for the live-out).
 * @returns {void}
 */
export function advance50mObjectRow(m) {
  const { regs, mem } = m;

  // The record stride. The oracle leaves it in DE and the still-oracle caller reuses it
  // as its own pointer increment, so publish it as a live-out at this boundary.
  regs.de = SLOT_STRIDE; // 0x0010 — LIVE-OUT

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;

    // Skip inactive records untouched.
    if ((mem.read8(slot + FIELD_ACTIVE) & ACTIVE_BIT) === 0) continue;

    const x = mem.read8(slot + FIELD_X);
    let cull = false;

    if (u8(x + 0x07) < 0x0e) {
      // Within seven pixels of the left edge (wrapping through zero) — remove it.
      cull = true;
    } else if (mem.read8(slot + FIELD_MOVER) === CENTER_SPLIT_MOVER) {
      // Center-split mover: step toward the near edge, cull at dead center.
      if (x === CENTER_X) {
        cull = true;
      } else {
        const step = x > CENTER_X
          ? mem.read8(M50_OBJ2_STEP_POS)  // right half — the +step shadow
          : mem.read8(M50_OBJ2_STEP_NEG); // left half — the -step shadow
        mem.write8(slot + FIELD_X, x + step);
      }
    } else {
      // Plain mover: step X by the object-3 shadow.
      mem.write8(slot + FIELD_X, x + mem.read8(M50_OBJ3_STEP));
    }

    if (cull) {
      mem.write8(slot + FIELD_ACTIVE, 0);
      mem.write8(slot + FIELD_X, 0);
      mem.write8(OBJ_65A0_SPRITES + CULL_SPRITE_STRIDE * i, 0);
    }
  }
}
