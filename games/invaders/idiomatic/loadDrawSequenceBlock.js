// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { ANIM_FRAME_COUNTER } from "./names.js";

/**
 * loadDrawSequenceBlock — copy a 12-byte draw/animation sequence into its fixed work-RAM slot.
 *
 * WHAT IT IS
 *   Loads one animation/draw "program" from the caller's source into the single work-RAM block the
 *   scripted-animation stepper runs from. It is a plain 12-byte block copy — the setup that arms an
 *   animation before stepAnimationFrame advances it frame by frame.
 *
 * ROLE IN THE MACHINE
 *   The destination ANIM_FRAME_COUNTER (0x20c2) is the base of the animation state block: stepAnimationFrame
 *   (0x1868) treats its first byte as the frame counter and the following bytes as the coordinate
 *   steps, running totals, end coordinate, and sprite-source base (ANIM_COORD_STEP_LO 0x20c3 ..
 *   ANIM_BASE_SPRITE_SRC 0x20cc; see mechanisms.md "Sprite drawing"). Seeding those 12 bytes from a
 *   ROM/RAM template is what selects which animation plays. The move itself is blockCopy (0x1a32), the
 *   general byte-for-byte mover, with both source and destination advancing.
 *
 * ROM 0x0ae2.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL/DE advanced by blockCopy past the 12 bytes; the effect is the seeded block in memory.
 *   `de` (the source) defaults from the register when the caller omits it.
 */
export function loadDrawSequenceBlock(m, de = m.regs.de) {
  // Copy 0x0c (12) bytes from the caller's source (DE) into the animation work slot at ANIM_FRAME_COUNTER.
  blockCopy(m, de, ANIM_FRAME_COUNTER, 0x0c);
}
