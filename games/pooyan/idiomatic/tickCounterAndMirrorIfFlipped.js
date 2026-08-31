// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
import { mirrorSpriteListVertically } from "./mirrorSpriteListVertically.js";
/**
 * tickCounterAndMirrorIfFlipped — tick the caller's per-frame countdown byte, then reflect the
 * whole sprite display list when the cabinet is running upside-down.
 *
 * ROM 0x0320-0x0329. Grounding: [seen].
 *
 * WHAT IT IS
 *   A short shared tail on the per-frame update path. A caller hands it, in register HL, the
 *   address of a one-byte countdown it wants advanced; this routine decrements that byte and then
 *   decides — from the cabinet's current screen orientation — whether the frame's sprites still
 *   need to be flipped to land correctly on the raster.
 *
 * ROLE IN THE MACHINE
 *   Pooyan can run inverted. A cocktail cabinet turns the picture around for the player seated on
 *   the far side of the table, and the flip-screen configuration can invert it permanently. That
 *   orientation lives in FLIP_SCREEN_FLAG (0x881f): a value of 1 is the normal upright picture,
 *   0 means the screen is flipped. When the screen is flipped, every sprite the frame just staged
 *   into the display list sits in the wrong place for the mirrored raster and has to be reflected.
 *   This routine is where that once-per-frame choice is made, immediately after the counter tick:
 *   an upright screen does nothing further, a flipped screen runs the full vertical-mirror pass
 *   over the sprite display list. The orientation flag itself is republished into the hardware
 *   flip latch elsewhere each frame; here it is only read, to gate the mirror.
 *
 * LIVE-OUT: memory only — the decremented countdown byte and, on the flipped path, the reflected
 *   SPRITE_DISPLAY_LIST (0x8840). No register value is meant to survive.
 */
export function tickCounterAndMirrorIfFlipped(m, counter = m.regs.hl) {
  // Work RAM as a flat byte array. Both the caller's countdown byte and the orientation flag at
  // FLIP_SCREEN_FLAG (0x881f) are ordinary work-RAM cells read and written through it.
  const { mem8 } = m;

  // Tick the caller's countdown: decrement the byte HL points at, wrapping through eight bits
  // (0x00 -> 0xff). This is the routine's unconditional side effect every frame; callers seed and
  // poll this byte to time their own per-frame events.
  mem8[counter] = u8(mem8[counter] - 1);

  // Gate on cabinet orientation. FLIP_SCREEN_FLAG (0x881f): non-zero (its upright value 1) means
  // the normal picture, so the staged sprites are already positioned correctly and there is
  // nothing more to do this frame. Only when the flag is 0 (screen flipped) does control fall
  // through to the mirror pass.
  if (mem8[FLIP_SCREEN_FLAG] !== 0) return; // upright: sprites already correct, skip the mirror

  // Screen is flipped: reflect all 24 records of the sprite display list at SPRITE_DISPLAY_LIST
  // (0x8840) about the vertical axis so each sprite registers against the mirrored raster edge.
  mirrorSpriteListVertically(m);
}
