// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand07 } from "./queueSoundCommand07.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  FLIP_SCREEN_FLAG,
  OBJ_HIT_FLAG_I0,
  OBJ_HIT_FLAG_I1,
  ANIM_SEQ_63FB,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";
/**
 * scanTargetSlotsAndSpawnOnProximityHit  ==  per-slot proximity scan that turns a caught coordinate into a live spawn.
 * ROM 0x638a-0x63fa.  Grounding: [seen].
 *
 * WHAT IT IS
 *   One inner loop of the object-collision pipeline. Every frame the machine walks its
 *   coordinate slots looking for a target that has drifted close to a moving actor box; the
 *   first slot that falls inside the proximity window is "claimed" — its record is stamped
 *   into the opening frames of a fresh object and that object is armed to appear on screen.
 *   The routine is shared: the projectile-collision seeder seedAndRunTargetProximityScan
 *   (coordinate table SPRITE_TARGET_SLOTS 0x887c, record list PROJECTILE_TABLE 0x8be8) and a
 *   sibling player-2 collision scan each hand it a coordinate table, a record list, a slot
 *   count, an actor box, and the interrupt-register parity, then consume the boolean it hands
 *   back to decide whether their own sweep keeps going.
 *
 * THE PAIRING
 *   Each pass lines up two parallel arrays by index:
 *     - a COORDINATE slot (stride 4): screen X at +0, screen Y at +2.
 *     - an object RECORD (stride 0x18): the record whose presence byte sits at +0.
 *   An empty record (presence byte 0) is skipped. A live slot's X is shifted by a small
 *   screen-orientation registration bias and its Y lifted by a fixed margin, then measured
 *   against the actor box.
 *
 * THE HIT
 *   A hit needs BOTH the horizontal and the vertical gap under the proximity limit. On a hit
 *   the record is written into its fixed opening state (state bytes 0/1/2 + a per-record
 *   countdown), the interrupt-parity hit flag is raised, the record is pointed at its spawn
 *   animation sequence, and the spawn sound + hunter-spawn display command are queued so the
 *   object is drawn and heard this frame.
 *
 * LIVE-OUT
 *   Returns a boolean AND, on a hit, leaves memory changed:
 *     true  = the scan ran to exhaustion with no hit (the caller may keep sweeping).
 *     false = a slot was claimed and spawned; the caller must abort its own scan.
 *   A hit additionally writes the claimed record (opening state + countdown at +0x11), one of
 *   the two interrupt-parity hit flags (0x8d1b / 0x8d1c), that record's animation pointer, and
 *   appends to the sound + display-command rings. A miss touches only the loop's own cursors.
 */

// Tuning constants baked into the ROM at 0x638a. The proximity window is square: a slot counts
// as touching the actor only when the gap on EACH axis is strictly under the limit.
const PROXIMITY_LIMIT = 0x06; // hit requires both |dx| and |dy| strictly below this (a 6-unit window)
const Y_MARGIN = 0x08; //        vertical bias added to both slot and actor Y before differencing
const X_BIAS_UPRIGHT = 0x05; //  slot X nudged +5 when the screen is upright
const X_BIAS_FLIPPED = 0xfe; //  -2 (0xfe read as signed 8-bit) when the screen is flipped
const COORD_STRIDE = 0x04; //    coordinate slots sit 4 bytes apart (X at +0, Y at +2)
const REC_STRIDE = 0x18; //      object records sit 0x18 bytes apart (presence byte at +0)

// |a - b| the way the hardware computes it: the 8-bit subtraction leaves a wrapped byte and a
// borrow. When it borrowed (a < b) the true magnitude is the two's-complement negation of that
// wrapped byte; otherwise the wrapped byte already IS the magnitude.
/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  return borrow ? (-raw) & 0xff : raw;
}

/**
 * @param m     machine state.
 * @param coord base of the coordinate-slot table (X at +0, Y at +2, stride 4).
 * @param count number of slots to scan before giving up.
 * @param rec   base of the parallel object-record list (presence byte at +0, stride 0x18).
 * @param box   the actor box every slot is tested against (its X at +0, Y at +2).
 * @param ireg  interrupt-register parity selecting which of the two hit flags to raise.
 */
export function scanTargetSlotsAndSpawnOnProximityHit(m, coord = m.regs.ix, count = m.regs.b, rec = m.regs.hl, box = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Local walking cursors so the caller's registers are undisturbed as the scan advances.
  let coordPtr = coord;
  let recPtr = rec;
  let remaining = count;

  for (;;) {
    // Skip empty slots: a record whose presence byte is zero holds no live target.
    if (mem8[recPtr] !== 0) {
      // Register the slot against the actor. The horizontal offset depends on screen
      // orientation (FLIP_SCREEN_FLAG at 0x881f: nonzero = upright), and the Y of both points
      // is lifted by a fixed margin so the compare happens about the object body, not its edge.
      const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_UPRIGHT : X_BIAS_FLIPPED;
      const slotX = (mem8[coordPtr] + xBias) & 0xff;
      const slotY = (mem8[coordPtr + 2] + Y_MARGIN) & 0xff;
      const actorX = mem8[box];
      // Horizontal gate first (cheaper): reject the slot the moment |dx| reaches the limit.
      const dx = absDiff((actorX - slotX) & 0xff, actorX < slotX);
      if (dx < PROXIMITY_LIMIT) {
        // Vertical gate: only slots already close in X pay for the Y compare.
        const actorY = (mem8[box + 2] + Y_MARGIN) & 0xff;
        const dy = absDiff((actorY - slotY) & 0xff, actorY < slotY);
        if (dy < PROXIMITY_LIMIT) {
          // HIT. Claim this record and bring the object to life. The first three bytes are the
          // fixed opening-state pattern (0/1/2); +0x11 seeds the record's countdown timer so
          // the object will later reach its own expiry step.
          mem8[recPtr + 0x00] = 0x00; // stamp the claimed record alive
          mem8[recPtr + 0x01] = 0x01;
          mem8[recPtr + 0x02] = 0x02;
          mem8[recPtr + 0x11] = 0x28;
          // Raise the hit flag for this scan's parity. The collision pass runs once per target
          // box, the two distinguished by the interrupt-register parity; each parity records its
          // hit in its own flag — 0x8d1b for I=0, 0x8d1c for I!=0 — so the boxes stay separate.
          mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01; // interrupt parity picks the flag
          // Point the claimed record at its spawn animation sequence (0x63fb) and restart it.
          setActorAnimation(m, recPtr, ANIM_SEQ_63FB);
          // Announce the spawn: append the spawn sound (command 0x07) and the hunter-spawn
          // display command (0x0315) so the new object is drawn and heard this frame.
          queueSoundCommand07(m);
          enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD);
          return false; // hit claimed — abort the caller's scan
        }
      }
    }
    // No hit on this slot: step both cursors in lock-step to the next pair and count it off.
    coordPtr = u16(coordPtr + COORD_STRIDE);
    recPtr = u16(recPtr + REC_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) return true; // scan exhausted, no hit
  }
}
