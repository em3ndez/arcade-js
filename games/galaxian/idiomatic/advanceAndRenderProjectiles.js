// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAndRenderProjectiles (ROM 0x0a74) -- integrate and draw the enemy shots each frame.
 *
 * WHAT IT IS
 *   The enemy shots (the bullets diving aliens rain on the player) live in one pool at loc_4260
 *   (0x4260). The same memory is read two ways: this routine treats it as SEVEN ten-byte records, each
 *   holding TWO five-byte sub-slots, while the spawn/collision code treats it as fourteen flat
 *   five-byte entries -- both correct, fourteen entries paired up. Each frame this routine picks which
 *   sub-slot of a record LEADS (using a phase bit), integrates that shot's motion, deactivates it when
 *   it runs off the play window, and writes its Y and tile code into the sprite shadow so it appears.
 *   This is what makes enemy shots actually move and draw; the aiming that CREATES them is elsewhere
 *   (spawnAimedProjectileAtPlayer).
 *
 * ROLE IN THE MACHINE
 *   Run once per frame from the object/render pipeline (mechanisms.md, "The projectile renderer and its
 *   collision siblings"). The phase bit is bit 0 of FRAME_COUNTER (0x425f); the mirror flag is bit 0 of
 *   the orientation cell loc_4018 (0x4018, cleared -> mirror the sprite Y). The output sprites land in
 *   the bullet band of the sprite shadow beginning at loc_4081 (0x4081), just above the object sprite
 *   shadow. A deactivated shot has its active, sub-position, and high bytes zeroed.
 *
 * Grounding: [seen] (names.js cert for 0x0a74).
 *
 * LIVE-OUT: the seven leading sub-slots' SUBPOS/POS_LO/POS_HI/ACTIVE integrated or cleared, the seven
 *   trailing sub-slots' SUBPOS bumped +2, and seven bullet-band sprite entries (Y + code) at 0x4081.
 */
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, loc_4018, loc_4260, loc_4081 } from "./names.js";

// Sub-slot layout (5 bytes) addressed by `rec`.
const ACTIVE = 0; // bit0 = slot active
const SUBPOS = 1; // sub-position, the on-screen Y source
const POS_LO = 2; // integrated position, low byte
const POS_HI = 3; // integrated position, high byte
const VELOCITY = 4; // signed per-frame velocity
// Five bytes per sub-slot; two sub-slots make one ten-byte record.
const SLOT_STRIDE = 5;

// Sprite-shadow entry layout addressed by `spr` (in the bullet band at 0x4081).
const SPR_CODE = 0;
const SPR_Y = 2;
// Four bytes per sprite-shadow entry.
const SPR_STRIDE = 4;

// Seven ten-byte records -> seven on-screen bullets this pass.
const RECORD_COUNT = 7;

export function advanceAndRenderProjectiles(m) {
  const { mem8 } = m;

  let rec = loc_4260;
  // Phase select: FRAME_COUNTER bit 0 alternates which sub-slot leads. When it is clear, the FIRST
  // sub-slot of the pool is the trailing one this frame -- bump its sub-position +2 and start the scan
  // on the second sub-slot instead (the two sub-slots of a pair thus take turns leading frame to frame).
  if ((mem8[FRAME_COUNTER] & 0x01) === 0) {
    mem8[rec + SUBPOS] = mem8[rec + SUBPOS] + 2;
    rec = u16(rec + SLOT_STRIDE);
  }

  // Orientation: when the screen-flip/orientation flag is clear the sprite Y is emitted mirrored
  // (one's-complement); when set it is emitted straight. Latched once before the loop.
  const mirrored = (mem8[loc_4018] & 0x01) === 0; // direction flag clear = mirror the sprite Y
  let spr = loc_4081;

  // Walk the seven leading sub-slots; `n` counts 7..1 so it can also flag the first three records below.
  for (let n = RECORD_COUNT; n >= 1; n--) {
    let deactivate = false;

    if ((mem8[rec + ACTIVE] & 0x01) === 0) {
      // Slot not active: nothing to integrate; fall through to the deactivate/clear + off-screen emit.
      deactivate = true; // inactive slot
    } else {
      // Active: advance the sub-position (the on-screen Y source) by two this frame.
      const subPos = (mem8[rec + SUBPOS] + 2) & 0xff;
      mem8[rec + SUBPOS] = subPos;
      if (subPos + 4 > 0xff) {
        // Sub-position reached the top of its range -> retire the shot.
        deactivate = true; // sub-position ran off the end
      } else {
        // Integrate the 16-bit position by TWICE the signed per-frame velocity.
        const vel = (mem8[rec + VELOCITY] << 24) >> 24; // sign-extend the velocity byte
        const pos = u16((mem8[rec + POS_LO] | (mem8[rec + POS_HI] << 8)) + vel * 2);
        mem8[rec + POS_LO] = pos;
        mem8[rec + POS_HI] = pos >> 8;
        // Left the vertical play window (high byte, biased by 0x10, below 0x20) -> retire the shot.
        if ((((pos >> 8) + 0x10) & 0xff) < 0x20) deactivate = true; // out of the vertical window
      }
    }

    if (deactivate) {
      // Retire: zero the active flag, the sub-position, and the position high byte.
      mem8[rec + ACTIVE] = 0;
      mem8[rec + SUBPOS] = 0;
      mem8[rec + POS_HI] = 0;
    }

    // Emit the sprite: Y from the sub-position (mirrored per the flag), code from the complemented
    // position high byte, with a +/-1 tile nudge on the first three records (n >= 5) so those bullets
    // draw with a slightly different tile. The mirror flag flips both the Y and the sign of that nudge.
    let code;
    if (mirrored) {
      mem8[spr + SPR_Y] = (0xff ^ mem8[rec + SUBPOS]) - 1; // complement, minus one
      code = 0xff ^ mem8[rec + POS_HI];
      if (n >= 5) code = code + 1;
    } else {
      mem8[spr + SPR_Y] = mem8[rec + SUBPOS] - 4;
      code = 0xff ^ mem8[rec + POS_HI];
      if (n >= 5) code = code - 1;
    }
    mem8[spr + SPR_CODE] = code;

    // Step past the leading sub-slot to its trailing partner, bump that partner's sub-position +2 (so
    // the pair keeps alternating), then step past it to the next record and advance the sprite pointer.
    rec = u16(rec + SLOT_STRIDE);
    mem8[rec + SUBPOS] = mem8[rec + SUBPOS] + 2;
    rec = u16(rec + SLOT_STRIDE);
    spr = u16(spr + SPR_STRIDE);
  }
}
