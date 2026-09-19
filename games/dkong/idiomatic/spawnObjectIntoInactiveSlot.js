// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnObjectIntoInactiveSlot — inactive-object arm of the per-object update loop. Tests the
 * one-shot spawn request (SPAWN_REQUEST bit 0); if none is pending the slot stays inactive and the
 * scan advances. If one is pending it consumes the request (clearing it so no other inactive slot
 * spawns this pass) and seeds the slot — fixed Y, X from the stirred random seed, animation-string
 * pointer at the string base, state and active flags set — then advances both scan cursors.
 *
 * LIVE-OUT: memory — SPAWN_REQUEST cleared, the object record's Y / X / state / active /
 * animation-pointer fields, and the stirred random seed; plus the registers the advance tail leaves
 * behind (object cursor +16, sprite cursor +4, remaining-object count preserved, step value 4).
 */

import {
  OBJ_ACTIVE,
  OBJ_ANIM_STRING_BASE,
  OBJ_STATE,
  OBJ_X,
  OBJ_Y,
  SPAWN_REQUEST,
} from "./names.js";
import { stirRandomSeed } from "./stirRandomSeed.js";
import { advanceToNextObject } from "./advanceToNextObject.js";

const OBJ_ANIM_PTR = 0x0e;
const SPAWN_Y = 80;

export function spawnObjectIntoInactiveSlot(m, ix = m.regs.ix) {
  const { regs, mem8 } = m;

  if ((mem8[SPAWN_REQUEST] & 0x01) === 0) {
    advanceToNextObject(m);
    return;
  }

  // Consume the one-shot request so no other inactive slot also spawns this pass.
  mem8[SPAWN_REQUEST] = 0;

  mem8[ix + OBJ_Y] = SPAWN_Y;
  mem8[ix + OBJ_STATE] = 1;

  // Initial X: stirred seed's low nibble biased down by 8, spreading over a 16-wide window that
  // straddles zero as a byte. The stirrer leaves the fresh seed in the accumulator.
  stirRandomSeed(m);
  const seed = regs.a;
  mem8[ix + OBJ_X] = (seed & 0x0f) - 8;

  mem8[ix + OBJ_ACTIVE] = 1;
  mem8[ix + OBJ_ANIM_PTR] = OBJ_ANIM_STRING_BASE;
  mem8[ix + OBJ_ANIM_PTR + 1] = (OBJ_ANIM_STRING_BASE >> 8);

  advanceToNextObject(m);
}
