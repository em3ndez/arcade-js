// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_DIR, ENEMY_SEGMENT, JUMP_MODE_SHAPE } from "./names.js";
import { seatShapeParamsAndEmit } from "./seatShapeParamsAndEmit.js";

/**
 * emitJumpModeSlot -- draw one slot's enemy in its current jump-mode shape. ROM 0xb60f.
 *
 * Role in the machine: emits the vector shape for an enemy in slot x while it is jumping/flipping between
 * lanes. The enemy's direction cell holds a 2-bit mode selecting one of four jump-frame shapes; the
 * routine looks that shape up and draws it seated on the enemy's target segment.
 *
 * Behavior: take the slot's direction byte (ENEMY_SLOT_DIR+x), mask its low 2 bits to a mode 0..3, index
 * the jump-shape table (JUMP_MODE_SHAPE, loc_b61e) by that mode to get the shape word, and pass it plus
 * the slot's target segment (ENEMY_SEGMENT+x) to the shared seat-and-emit helper (seatShapeParamsAndEmit,
 * 0xbcfd), which places the shape and appends its vector record.
 *
 * Live-out: whatever seatShapeParamsAndEmit writes -- the seated shape parameters and the emitted vector
 * record in the display list. Grounding: [seen].
 */
export function emitJumpModeSlot(m, x = m.regs.x) {
  const { mem8 } = m;
  const mode = mem8[u16(ENEMY_SLOT_DIR + x)] & 0x03; // low 2 bits pick one of four jump shapes
  return seatShapeParamsAndEmit(m, mem8[u16(JUMP_MODE_SHAPE + mode)], mem8[u16(ENEMY_SEGMENT + x)]);
}
