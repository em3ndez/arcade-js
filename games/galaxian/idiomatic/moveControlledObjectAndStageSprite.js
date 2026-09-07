// SPDX-License-Identifier: GPL-3.0-only
// moveControlledObjectAndStageSprite -- ROM 0x0837, grounding [seen].
// Moves the player ship one step per frame and stages its sprite. The ship's
// horizontal position lives in a single cell, loc_4202 (0x4202); that byte does
// double duty -- it is where the ship is, and, because every attacker aims at
// where the ship is, it is also the target anchor the enemy AI reads. The
// play-phase entry parks it at 128 (screen centre) at the start of a life.
// Each frame this routine picks a movement source, nudges the position within
// its bounds, then folds it into a sprite value and writes four interleaved
// (value, code) pairs into OBJ_STAGE_BLOCK (0x4054), so the ship's sprite
// reaches the display regardless of which branch ran.
// Live-out: loc_4202 (updated ship X) and the 8-byte OBJ_STAGE_BLOCK region.
import {
  OBJ_ACTIVE_FLAG, loc_4202, OBJ_MOVE_CMD, OBJ_STAGE_BLOCK,
  IN0_SHADOW, IN1_SHADOW, loc_4006, loc_4018, loc_4201,
} from "./names.js";

// Position -> staged sprite value: one's-complement, then offset by 128 into a
// byte. The hardware sprite coordinate is this negated/offset ship position.
function negatePos(pos) {
  return (~pos + 128) & 0xff;
}

export function moveControlledObjectAndStageSprite(m) {
  const { mem8 } = m;

  // `value` is the staged sprite coordinate; `code` is the sprite-type byte
  // paired with it (6 for the live/parked ship, 7 for the alternate pose).
  let value, code;

  // OBJ_ACTIVE_FLAG (0x4200) bit0 gates the whole object subsystem. When it is
  // set the ship is live and steerable, so run the normal move+clamp path.
  if (mem8[OBJ_ACTIVE_FLAG] & 1) {
    // Choose the movement bits. Mode flag loc_4006 (0x4006) bit0 clear = the
    // demo-mode autopilot command OBJ_MOVE_CMD (0x423f); bit0 set = a live
    // controller -- the second port IN1_SHADOW when orientation flag loc_4018
    // (0x4018) bit0 is set, else the first port IN0_SHADOW. Bits 2 and 3 of
    // whichever byte we get carry the up/down direction.
    const move = (mem8[loc_4006] & 1) === 0 ? mem8[OBJ_MOVE_CMD]   // auto/AI command
               : (mem8[loc_4018] & 1)       ? mem8[IN1_SHADOW]     // second input port
               :                              mem8[IN0_SHADOW];    // first input port
    // Step the ship one pixel toward its floor/ceiling. bit3 nudges down (but
    // not below 22 -- 23 is the comparison threshold, not the floor) and bit2
    // nudges up (never past 233), so the ship tracks smoothly and cannot walk
    // off either edge of the play-field.
    let pos = mem8[loc_4202];
    if (move & 0x08 && pos >= 23) pos -= 1;  // bit3: step down while above the floor
    if (move & 0x04 && pos < 233) pos += 1;  // bit2: step up while below the ceiling
    // Commit the new position (loc_4202 is read back by the enemy AI) and fold
    // it into the sprite value under the normal live-ship code 6.
    mem8[loc_4202] = pos;
    value = negatePos(pos);
    code = 6;
  } else if (mem8[loc_4201] & 1) {
    // Inactive but loc_4201 (0x4201) bit0 set: the death/animation pose. Stage
    // the current position unchanged under the alternate code 7, with no clamp.
    value = negatePos(mem8[loc_4202]);
    code = 7;
  } else {
    // Fully inactive: slam the ship position to zero and stage that under the
    // normal code 6.
    mem8[loc_4202] = 0;
    value = negatePos(0);
    code = 6;
  }

  // Stage four interleaved (value, code) pairs into OBJ_STAGE_BLOCK -- the
  // hardware sprite record the ship is drawn from, written as four copies the
  // way the Z80 original unrolled the store.
  for (let i = 0; i < 4; i++) {
    mem8[OBJ_STAGE_BLOCK + 2 * i] = value;
    mem8[OBJ_STAGE_BLOCK + 2 * i + 1] = code;
  }
}
