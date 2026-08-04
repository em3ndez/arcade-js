// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveHammerSprite — per-frame hammer sprite / background-tune dispatcher.
 *
 * Called once every serviced frame. It drives one of the two hammer objects and routes on
 * whether Mario currently holds a hammer:
 *
 *   1. Two skip gates first: the board gate — a hammer exists only on 25m, 50m and 100m
 *      (mask bits 0, 1 and 3), never on 75m — and the Mario-alive gate. Either closed and
 *      the whole routine is skipped.
 *   2. It selects which object of the pair to drive from bit 0 of the FIRST object's
 *      HAMMER_IN_PLAY field: bit set keeps object 1, bit clear picks object 2. It seeds that
 *      object's sprite displacement.
 *   3. Hammer NOT in hand (MARIO_HAMMER_ACTIVE bit 0 clear): hand off to the pending-hammer
 *      build arm, which itself checks whether a hammer is merely pending, and stop.
 *   4. Hammer in hand: clear the pending flag, switch the background tune to the hammer
 *      theme, stamp the object's COLLISION HALF-EXTENTS, and build the sprites from Mario's
 *      current pose — the object shows the hammer tile facing the way Mario faces, and an
 *      on-screen hammer-swing code is derived from Mario's pose. The swing-animation phase
 *      (HAMMER_TIMER_LO bit 3) selects between two poses; the alternate phase re-stamps the
 *      extents and displacement and, when the swing code's high bit is set, nudges the
 *      horizontal displacement. All hammer-in-hand paths converge on the active-hammer
 *      update, which ticks the duration counter, lays down this frame's record, and ends the
 *      hammer at expiry.
 *
 * THE TWO EXTENT BYTES ARE THE SWINGING HAMMER'S HITBOX. OBJ_HIT_EXTENT_X and
 * OBJ_HIT_EXTENT_Y are the per-axis collision HALF-EXTENTS, not opaque state bytes. This
 * routine stamps 0x06 / 0x03 on the main swing pose and 0x05 / 0x06 on the alternate pose,
 * and the board's hit check takes exactly those two bytes as its per-axis base tolerances.
 * So the box the hammer smashes with changes shape frame to frame with the swing, and this
 * routine is what changes it.
 *
 * The callees still read their inputs from registers, so this routine loads the board mask
 * before the board gate, the object base and sprite-record destination before both build
 * arms, and the object tile code plus the on-screen hammer code before the active-hammer
 * update.
 *
 * LIVE-OUT: memory-only. Every path tails into a build arm, and the per-frame caller
 * discards whatever comes back.
 */

import { u8 } from "../../../core/int.js";
import {
  MARIO_HAMMER_ACTIVE,
  MARIO_HAMMER_PENDING,
  MARIO_SPRITE_CODE,
  HAMMER_TIMER_LO,
  SND_BGM,
  OBJ_PAIR_6680,
  HAMMER_IN_PLAY,
  OBJ_HIT_EXTENT_X,
  OBJ_HIT_EXTENT_Y,
} from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { buildPendingHammerSprite } from "./buildPendingHammerSprite.js";
import { updateActiveHammer } from "./updateActiveHammer.js";

// Board applicability mask: bit0 25m, bit1 50m, bit3 100m — the boards a hammer can appear
// on. 75m, bit 2, is excluded.
const HAMMER_BOARDS = 0x0b;

// The two hammer objects this dispatcher drives. Each pairs an object-record base with its
// own sprite-record slot inside the sprite buffer; neither slot carries a shared name.
const OBJ2_BASE = OBJ_PAIR_6680 + 0x10; // the pair's second object record
const OBJ1_RECORD = 0x6a18;             // object-1 sprite-record slot
const OBJ2_RECORD = 0x6a1c;             // object-2 sprite-record slot

// Object-record field offsets carrying no shared name.
const OBJ_X_DISPLACEMENT = 0x0e; // horizontal offset added to Mario's X by the record write
const OBJ_Y_DISPLACEMENT = 0x0f; // vertical offset added to Mario's Y by the record write

const HAMMER_TILE_BASE = 0x1e;   // base hammer sprite tile; Mario's facing bit is OR'd on top
const HAMMER_TUNE = 0x04;        // background-tune index while a hammer is held
const FACING_BIT = 0x80;         // horizontal-flip bit of MARIO_SPRITE_CODE (1 = facing right)
const SWING_PHASE_BIT = 0x08;    // HAMMER_TIMER_LO bit3 — the 8-frame swing-animation phase
const HAMMER_CODE_FLAG = 0x08;   // fixed flag set in the on-screen hammer-swing code
const SWING_ALT_BIT = 0x01;      // low bit set on both codes during the alternate swing pose

export function driveHammerSprite(m) {
  const { regs, mem } = m;

  // The hammer only exists on 25m/50m/100m; skip the whole routine otherwise.
  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  // Do nothing while Mario is dead.
  if (!marioActiveGuard(m)) return;

  // Pick which object of the pair to drive from bit0 of the first object's HAMMER_IN_PLAY field.
  let objBase, recordDest;
  if ((mem.read8((OBJ_PAIR_6680 + HAMMER_IN_PLAY) & 0xffff) & 0x01) !== 0) {
    objBase = OBJ_PAIR_6680;
    recordDest = OBJ1_RECORD;
  } else {
    objBase = OBJ2_BASE;
    recordDest = OBJ2_RECORD;
  }
  // The callees read the object base and the record destination from the register file.
  regs.ix = objBase;
  regs.de = recordDest;

  // Seed this frame's sprite displacement (some swing phases overwrite it below).
  mem.write8((objBase + OBJ_X_DISPLACEMENT) & 0xffff, 0x00);
  mem.write8((objBase + OBJ_Y_DISPLACEMENT) & 0xffff, 0xf0);

  // No hammer in hand: hand off to the pending-hammer build arm (which decides whether a
  // hammer is merely pending) and stop.
  if ((mem.read8(MARIO_HAMMER_ACTIVE) & 0x01) === 0) {
    buildPendingHammerSprite(m);
    return;
  }

  // A hammer is in hand this frame. Clear the pending flag, switch to the hammer tune, and
  // stamp this swing pose's collision half-extents — the box the hammer smashes with.
  mem.write8(MARIO_HAMMER_PENDING, 0x00);
  mem.write8(SND_BGM, HAMMER_TUNE);
  mem.write8((objBase + OBJ_HIT_EXTENT_X) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_HIT_EXTENT_Y) & 0xffff, 0x03);

  // Build the sprites from Mario's current pose: the object shows the hammer tile facing the
  // way Mario faces; the on-screen hammer-swing code is Mario's pose shifted up one, with the
  // facing bit restored and a fixed code flag.
  const marioCode = mem.read8(MARIO_SPRITE_CODE);
  const facing = marioCode & FACING_BIT;
  let objTile = HAMMER_TILE_BASE | facing;                         // -> the object's tile code
  let hammerCode = u8(marioCode << 1) | facing | HAMMER_CODE_FLAG; // -> Mario's on-screen code

  // Swing phase clear: update the active hammer with this pose and stop.
  if ((mem.read8(HAMMER_TIMER_LO) & SWING_PHASE_BIT) === 0) {
    regs.b = objTile;
    regs.c = hammerCode;
    updateActiveHammer(m);
    return;
  }

  // Alternate swing pose: set the low bit on both codes, then re-stamp the object's collision
  // half-extents and displacement for this pose.
  objTile |= SWING_ALT_BIT;
  hammerCode |= SWING_ALT_BIT;
  mem.write8((objBase + OBJ_HIT_EXTENT_X) & 0xffff, 0x05);
  mem.write8((objBase + OBJ_HIT_EXTENT_Y) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_Y_DISPLACEMENT) & 0xffff, 0x00);
  mem.write8((objBase + OBJ_X_DISPLACEMENT) & 0xffff, 0xf0);

  // When the on-screen swing code's high bit is set, nudge the horizontal displacement.
  if ((hammerCode & FACING_BIT) !== 0) {
    mem.write8((objBase + OBJ_X_DISPLACEMENT) & 0xffff, 0x10);
  }

  regs.b = objTile;
  regs.c = hammerCode;
  updateActiveHammer(m);
}
