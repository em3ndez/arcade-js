// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveHammerSprite — per-frame hammer sprite / background-tune dispatcher.  ROM 0x2ED4.
 *
 * Called once every serviced frame (from loc_197a). It drives one of the two hammer
 * objects and routes on whether Mario currently holds a hammer:
 *
 *   1. Two skip gates first: the rst 0x30 board gate (the hammer exists only on
 *      25m/50m/100m — mask bit0/bit1/bit3, NOT 75m) and the rst 0x10 alive gate. Either
 *      closed and the whole routine is skipped.
 *   2. It selects which object of the pair to drive from bit0 of the first object's +1
 *      field: bit set keeps object 1 (record 0x6A18); bit clear picks object 2 (record
 *      0x6A1C). It seeds that object's sprite displacement (+0x0E = 0, +0x0F = 0xF0).
 *   3. Hammer NOT in hand (MARIO_HAMMER_ACTIVE bit0 clear): hand off to the pending-hammer
 *      build arm (buildPendingHammerSprite), which itself checks whether a hammer is merely
 *      pending, and stop.
 *   4. Hammer in hand: clear the pending flag, switch the background tune to the hammer
 *      theme, stamp the object's two state bytes, and build the sprites from Mario's
 *      current pose — the object shows the hammer tile facing the way Mario faces, and an
 *      on-screen hammer-swing code is derived from Mario's pose. The swing-animation phase
 *      (HAMMER_TIMER_LO bit3) selects between two poses; the alternate phase re-stamps the
 *      object state/displacement and, when the swing code's high bit is set, nudges the
 *      horizontal displacement. All hammer-in-hand paths converge on updateActiveHammer,
 *      which ticks the duration counter, lays down this frame's record, and ends the
 *      hammer at expiry.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees take honest args): the callees still
 * read their inputs from registers, so this routine loads exactly what the oracle's call
 * sites load — the board mask before boardBitGate, the object base and sprite-record
 * destination before both build arms, and the object tile code + on-screen hammer code
 * before updateActiveHammer.
 *
 * Promoted from loc_2ed4 (DK understanding pass 10, independent proposer≠confirmer, MODERATE-HIGH):
 * MARIO_HAMMER_ACTIVE's registry note names this routine the hammer sprite/BGM swap; it touches
 * only rated cells (MARIO_HAMMER_ACTIVE / _PENDING, MARIO_SPRITE_CODE, HAMMER_TIMER_LO, SND_BGM,
 * OBJ_PAIR_6680) and both build arms are English-named (buildPendingHammerSprite / updateActiveHammer).
 * The board mask 0x0b (25m/50m/100m) is exactly the hammer boards.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ed4.test.js.
 * GATE:     captured + crafted. 0x2ED4 is dispatched every serviced attract frame (1478
 *           real dispatches / 2500 frames), and attract naturally exercises BOTH arms —
 *           the hammer-inactive build hand-off (966) and the active update (512). Crafted
 *           entries then pin BOTH object selections, the two board/alive skips, the
 *           inactive early-return and build (both facings), and the active swing-phase
 *           clear/set sub-branches with the high-bit displacement nudge. The RAM diff
 *           excludes the dead STACK_SCRATCH the oracle's dissolved rst-0x30/rst-0x10
 *           push16/ret churn writes (the only stack writes, all inside the region). Teeth:
 *           an inverted object selection, a wrong hammer tune, and a dropped facing bit.
 * LIVE-OUT: memory-only. Every path tail-calls a build arm and the per-frame caller
 *           discards the result; the oracle's residual registers/flags and the terminal
 *           return reach no consumer. The boolean-guard returns replace the rst-0x30/rst-
 *           0x10 stack skip idiom.
 * NAMES:    MARIO_HAMMER_ACTIVE (0x6217), MARIO_HAMMER_PENDING (0x6218), MARIO_SPRITE_CODE
 *           (0x6207), HAMMER_TIMER_LO (0x6394), SND_BGM (0x6089), OBJ_PAIR_6680 (0x6680) —
 *           from ram.js. boardBitGate (ROM 0x0030), marioActiveGuard (ROM 0x0010),
 *           buildPendingHammerSprite (ROM 0x2F97), updateActiveHammer (ROM 0x2F43) —
 *           direct-called. The pair's second object base (0x6690), its two sprite-record
 *           slots (0x6A18 / 0x6A1C, inside SPRITE_BUFFER) and the object-record field
 *           offsets (+1 select, +0x09/+0x0A state, +0x0E/+0x0F displacement) have no ram.js
 *           name yet and stay local hex consts here.
 */

import { u8 } from "../../../core/int.js";
import {
  MARIO_HAMMER_ACTIVE,
  MARIO_HAMMER_PENDING,
  MARIO_SPRITE_CODE,
  HAMMER_TIMER_LO,
  SND_BGM,
  OBJ_PAIR_6680,
  OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y,} from "./ram.js";
import { boardBitGate } from "./boardBitGate.js";               // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js";       // ROM 0x0010 (rst 0x10)
import { buildPendingHammerSprite } from "./buildPendingHammerSprite.js"; // ROM 0x2F97
import { updateActiveHammer } from "./updateActiveHammer.js";   // ROM 0x2F43

// rst-0x30 board applicability mask: bit0 25m, bit1 50m, bit3 100m — the boards a hammer
// can appear on (75m, bit2, is excluded).
const HAMMER_BOARDS = 0x0b;

// The two hammer objects this dispatcher drives. Each pairs an object-record base with its
// sprite-record slot in the sprite buffer (both slots live inside SPRITE_BUFFER and have no
// ram.js name, so they stay hex).
const OBJ2_BASE = OBJ_PAIR_6680 + 0x10; // 0x6690 — the pair's second object record
const OBJ1_RECORD = 0x6a18;             // object-1 sprite-record slot (SPRITE_BUFFER)
const OBJ2_RECORD = 0x6a1c;             // object-2 sprite-record slot (SPRITE_BUFFER)

// Object-record field offsets with no ram.js name yet.
const OBJ_SELECT = 0x01;         // +1 bit0 picks which object of the pair to drive
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

  // rst 0x30 — the hammer only exists on 25m/50m/100m; skip the whole routine otherwise.
  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  // rst 0x10 — do nothing while Mario is dead.
  if (!marioActiveGuard(m)) return;

  // Pick which object of the pair to drive from bit0 of the first object's +1 field.
  let objBase, recordDest;
  if ((mem.read8((OBJ_PAIR_6680 + OBJ_SELECT) & 0xffff) & 0x01) !== 0) {
    objBase = OBJ_PAIR_6680;  // 0x6680
    recordDest = OBJ1_RECORD; // 0x6a18
  } else {
    objBase = OBJ2_BASE;      // 0x6690
    recordDest = OBJ2_RECORD; // 0x6a1c
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
  // stamp the object's two state bytes.
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

  // Alternate swing pose: set the low bit on both codes, then re-stamp the object's state
  // and displacement for this pose.
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
