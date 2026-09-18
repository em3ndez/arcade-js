// SPDX-License-Identifier: GPL-3.0-only
/**
 * armMarioClimbAtLadderEnd — at a ladder end, stamp the ladder-standing pose and this frame's
 * climb-limit pair, ARMING a climb the movement code may then perform. The Up/Down half of the
 * ladder-collision handler.
 *
 * LIVE-OUT: memory only.
 */

import {
  MARIO_HAMMER_ACTIVE,
  MARIO_X,
  MARIO_Y,
  MARIO_SPRITE_CODE,
  MARIO_CLIMB_LIMIT_A,
  MARIO_CLIMB_LIMIT_B,
} from "./names.js";
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js";
import { loc_1b4e } from "./loc_1b4e.js";
import { climbDownWhileHeld } from "./climbDownWhileHeld.js";

const CLIMB_FLAG = 0x621a;
const TABLE_SCAN_COUNT = 21;

// Mario's sprite code while STANDING at a ladder, in the low bits; the facing bit is preserved.
const LADDER_STANDING_POSE = 0x06;
const FACING_BIT = 0x80;

// A match with this many or fewer entries left to scan counts as "near the end of the table".
const NEAR_END_OF_SCAN = 4;

export function armMarioClimbAtLadderEnd(m) {
  const { regs, mem8 } = m;

  // Hammer gate: proceed only when the hammer state is not exactly 1.
  if (mem8[MARIO_HAMMER_ACTIVE] === 1) return;

  // Two probes: the (Y+8) climb-limit / discriminator, and a grid-aligned X search key.
  const yLimit = (mem8[MARIO_Y] + 8) & 0xff;
  const searchKey = (mem8[MARIO_X] | 0x03) & 0xfb;

  regs.a = searchKey;
  regs.d = yLimit;
  regs.bc = TABLE_SCAN_COUNT;
  if (!findOppositeLadderEnd(m)) return; // miss: the callee unwound to the caller's caller

  const tag = regs.a;
  const slotByte = regs.b;
  const residualCount = regs.c;

  // Stamp the ladder-STANDING pose, keeping the facing bit.
  mem8[MARIO_SPRITE_CODE] = (mem8[MARIO_SPRITE_CODE] & FACING_BIT) | LADDER_STANDING_POSE;

  const nearEndOfScan = residualCount <= NEAR_END_OF_SCAN ? 1 : 0;
  mem8[CLIMB_FLAG] = nearEndOfScan;

  if (tag === 0) {
    // Ordinary order: commit callee takes the slot byte in B and (Y+8) in D, then climbs up.
    loc_1b4e(m, slotByte, yLimit);
    return;
  }

  if (nearEndOfScan !== 0) return;

  // Commit the pair in the opposite order, then hand off to the Down/Up climb dispatch.
  mem8[MARIO_CLIMB_LIMIT_A] = yLimit;
  mem8[MARIO_CLIMB_LIMIT_B] = slotByte;
  climbDownWhileHeld(m);
}
