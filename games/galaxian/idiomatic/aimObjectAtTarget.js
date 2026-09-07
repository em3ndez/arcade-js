// SPDX-License-Identifier: GPL-3.0-only
/**
 * aimObjectAtTarget -- point a diving attacker's sprite at the player and store the heading octant.
 *
 * WHAT IT IS
 *   The aiming step of the enemy-shot logic. When a diving Galaxian reaches a firing row it drops a bullet
 *   aimed at the player; this routine computes which of eight directions the object should face and writes
 *   that heading into the object's record. It does not fire -- it only sets the direction the later
 *   spawnAimedProjectileAtPlayer step reads back.
 *
 * ROLE IN THE MACHINE
 *   Called from the object-AI flight handlers advanceObjectFlightAndFire (0x0e2b) and
 *   advanceHomingObjectFlightAndFire (0x0faf) with the object record in IX. It forms a slope from two
 *   magnitudes -- the vertical drop from the top of the play area down to the sprite, and the horizontal
 *   delta from the sprite to the ship's X anchor loc_4202 -- and hands it to computeDirectionOctantFromSlope
 *   (0x11d0), which divides them (divideUnsigned8), clamps a too-steep quotient, and returns the top three
 *   bits as a 0-7 octant. A ship to the left is handled by mirroring: aim at the reflected magnitude, then
 *   negate the resulting octant so it points back left.
 *
 * ROM 0x11b0.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the object's direction field (IX+OBJ_DIR). No register result.
 */
import { computeDirectionOctantFromSlope } from "./computeDirectionOctantFromSlope.js";
import { loc_4202 } from "./names.js";

// Byte offsets into the IX object record touched by the aim: two inputs (screen Y and X) and one output.
const OBJ_Y = 3;   // sprite Y within the IX object record
const OBJ_X = 4;   // sprite X
const OBJ_DIR = 5; // direction octant (output)

export function aimObjectAtTarget(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Vertical delta: from the top of the play area (0xf0) down to the sprite -- the slope's divisor.
  // Larger values mean the attacker is higher above its firing target, i.e. a shallower dive angle.
  const vertical = (0xf0 - mem8[obj + OBJ_Y]) & 0xff;

  // Horizontal delta from the sprite to the target-X anchor; negative means the target is to the left.
  // loc_4202 is the player-ship reference X the whole aiming/firing cluster steers toward.
  const horizontal = mem8[loc_4202] - mem8[obj + OBJ_X];

  if (horizontal < 0) {
    // Target to the left: octant of the mirrored magnitude, then mirror the octant back.
    // computeDirectionOctantFromSlope only takes unsigned magnitudes, so feed it the negated horizontal
    // delta to get the right-facing octant, then negate that octant so the stored heading faces left.
    const octant = computeDirectionOctantFromSlope(m, (-horizontal) & 0xff, vertical);
    const mirrored = (-octant) & 0xff;
    mem8[obj + OBJ_DIR] = mirrored;
  } else {
    // Target at or to the right: the horizontal delta is already a usable magnitude; the octant it
    // yields is stored directly as the object's heading.
    mem8[obj + OBJ_DIR] = computeDirectionOctantFromSlope(m, horizontal, vertical);
  }
}
