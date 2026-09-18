// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveHammerSprite — per-frame hammer sprite / background-tune dispatcher. Skips when no
 * hammer applies to the board or while Mario is dead, picks one of the two hammer objects,
 * and either hands off to the pending-hammer build arm (no hammer held) or, with a hammer in
 * hand, clears the pending flag, switches to the hammer tune, stamps the current swing pose's
 * collision half-extents, and builds the sprites from Mario's pose.
 *
 * LIVE-OUT: memory-only.
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

const HAMMER_BOARDS = 0x0b;

const OBJ2_BASE = OBJ_PAIR_6680 + 0x10; // the pair's second object record
const OBJ1_RECORD = 0x6a18;             // object-1 sprite-record slot
const OBJ2_RECORD = 0x6a1c;             // object-2 sprite-record slot

const OBJ_X_DISPLACEMENT = 0x0e; // horizontal offset added to Mario's X by the record write
const OBJ_Y_DISPLACEMENT = 0x0f; // vertical offset added to Mario's Y by the record write

const HAMMER_TILE_BASE = 0x1e;   // base hammer sprite tile; Mario's facing bit is OR'd on top
const HAMMER_TUNE = 0x04;        // background-tune index while a hammer is held
const FACING_BIT = 0x80;         // horizontal-flip bit of MARIO_SPRITE_CODE (1 = facing right)
const SWING_PHASE_BIT = 0x08;    // HAMMER_TIMER_LO bit3 — the 8-frame swing-animation phase
const HAMMER_CODE_FLAG = 0x08;   // fixed flag set in the on-screen hammer-swing code
const SWING_ALT_BIT = 0x01;      // low bit set on both codes during the alternate swing pose

export function driveHammerSprite(m) {
  const { regs, mem8 } = m;

  if (!boardBitGate(m, HAMMER_BOARDS)) return;

  if (!marioActiveGuard(m)) return;

  let objBase, recordDest;
  if ((mem8[(OBJ_PAIR_6680 + HAMMER_IN_PLAY) & 0xffff] & 0x01) !== 0) {
    objBase = OBJ_PAIR_6680;
    recordDest = OBJ1_RECORD;
  } else {
    objBase = OBJ2_BASE;
    recordDest = OBJ2_RECORD;
  }
  regs.ix = objBase;
  regs.de = recordDest;

  mem8[(objBase + OBJ_X_DISPLACEMENT) & 0xffff] = 0x00;
  mem8[(objBase + OBJ_Y_DISPLACEMENT) & 0xffff] = 0xf0;

  if ((mem8[MARIO_HAMMER_ACTIVE] & 0x01) === 0) {
    buildPendingHammerSprite(m);
    return;
  }

  mem8[MARIO_HAMMER_PENDING] = 0x00;
  mem8[SND_BGM] = HAMMER_TUNE;
  mem8[(objBase + OBJ_HIT_EXTENT_X) & 0xffff] = 0x06;
  mem8[(objBase + OBJ_HIT_EXTENT_Y) & 0xffff] = 0x03;

  const marioCode = mem8[MARIO_SPRITE_CODE];
  const facing = marioCode & FACING_BIT;
  let objTile = HAMMER_TILE_BASE | facing;                         // -> the object's tile code
  let hammerCode = u8(marioCode << 1) | facing | HAMMER_CODE_FLAG; // -> Mario's on-screen code

  if ((mem8[HAMMER_TIMER_LO] & SWING_PHASE_BIT) === 0) {
    regs.b = objTile;
    regs.c = hammerCode;
    updateActiveHammer(m);
    return;
  }

  objTile |= SWING_ALT_BIT;
  hammerCode |= SWING_ALT_BIT;
  mem8[(objBase + OBJ_HIT_EXTENT_X) & 0xffff] = 0x05;
  mem8[(objBase + OBJ_HIT_EXTENT_Y) & 0xffff] = 0x06;
  mem8[(objBase + OBJ_Y_DISPLACEMENT) & 0xffff] = 0x00;
  mem8[(objBase + OBJ_X_DISPLACEMENT) & 0xffff] = 0xf0;

  if ((hammerCode & FACING_BIT) !== 0) {
    mem8[(objBase + OBJ_X_DISPLACEMENT) & 0xffff] = 0x10;
  }

  regs.b = objTile;
  regs.c = hammerCode;
  updateActiveHammer(m);
}
