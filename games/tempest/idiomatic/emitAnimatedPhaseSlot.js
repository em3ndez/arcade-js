// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, FRAME_COUNTER } from "./names.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

/**
 * emitAnimatedPhaseSlot — draw enemy slot X's shape with a frame-driven animation phase. ROM 0xb622.
 *
 * Role in the machine: enemies (flippers, tankers, spikers, and the rest) ride the tube's segment
 * lanes. This routine draws one such creature: it looks up which lane enemy slot X currently occupies
 * and selects one of four shape variants keyed to the global frame counter, so the drawn creature
 * cycles through its animation frames as the game runs.
 *
 * Behavior: reads the enemy's segment/lane target from ENEMY_SEGMENT+X into Y; forms the shape index A
 * from the low two bits of FRAME_COUNTER (a 0..3 phase), left-shifted by one and biased by 0x12, so the
 * four phases land on shape params 0x12 / 0x14 / 0x16 / 0x18; then hands (A = shape, Y = segment) to
 * seatShapeParamsAndEmit, which seats those params and appends the draw record.
 *
 * Live-out: whatever seatShapeParamsAndEmit emits into the vector draw stream for this slot; nothing
 * is written back to zero page here. Grounding: [seen].
 */
export function emitAnimatedPhaseSlot(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(ENEMY_SEGMENT + x)];           // lane/segment this enemy slot occupies
  const a = (((mem8[FRAME_COUNTER] & 0x03) << 1) + 0x12) & 0xff;  // four-phase shape index 0x12..0x18
  return seatShapeParamsAndEmit(m, a, y);
}
