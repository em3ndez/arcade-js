// SPDX-License-Identifier: GPL-3.0-only
/**
 * service50mObjectSpawnRequest — service the 50m moving-object spawn request, paced by a cooldown
 * timer.
 *
 * While the cooldown timer runs, tick it down and return. Once it drains, act only on a pending
 * request: scan the six object records for a free slot (active-flag bit 0 clear) and bring the
 * first free one to life. The seed roll plus the 50m step-direction latches choose the record's Y
 * (0x7C default or 0xCC) and X (0x07 default or 0xF8); the slot is stamped with its activate flag,
 * sprite code and hit extents, the cooldown timer is reloaded, and the request is cleared. On the
 * spawn path the shared decrement lands on SPIN_COUNT, not the freshly-reloaded timer, because the
 * seed stirrer leaves the pointer there; the two no-op returns decrement nothing.
 *
 * LIVE-OUT: memory only.
 */

import {
  OBJ_SPAWN_TIMER,
  OBJ_SPAWN_REQ,
  OBJ_ARRAY_65A0,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  M50_OBJ2_STEP_DIR,
  M50_OBJ3_STEP_DIR,
  SPIN_COUNT,
  OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y,} from "./names.js";
import { stirRandomSeed } from "./stirRandomSeed.js";

const SLOT_STRIDE = 0x10; // the record stride of the object array scanned here
const SLOT_COUNT = 6;     // records scanned for a free slot

export function service50mObjectSpawnRequest(m) {
  const { regs, mem8 } = m;

  if (mem8[OBJ_SPAWN_TIMER] !== 0) {
    mem8[OBJ_SPAWN_TIMER] = mem8[OBJ_SPAWN_TIMER] - 1;
    return;
  }

  if (mem8[OBJ_SPAWN_REQ] === 0) return; // nothing requested — no decrement

  let slot = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const base = (OBJ_ARRAY_65A0 + i * SLOT_STRIDE) & 0xffff;
    if ((mem8[(base + OBJ_ACTIVE) & 0xffff] & 0x01) === 0) {
      slot = base;
      break;
    }
  }
  if (slot === -1) return; // every slot busy — nothing spawned, no decrement

  stirRandomSeed(m);
  const roll = regs.a;
  mem8[(slot + OBJ_Y) & 0xffff] = 0x7c;

  let overrideY = roll < 0x60;
  let overrideX; // true -> X field becomes 0xF8, false -> stays 0x07

  if (!overrideY) {
    if (((mem8[M50_OBJ2_STEP_DIR] - 1) & 0xff) !== 0) {
      stirRandomSeed(m);
      overrideX = regs.a < 0x68;
    } else {
      overrideY = true;
    }
  }

  if (overrideY) {
    mem8[(slot + OBJ_Y) & 0xffff] = 0xcc;
    overrideX = (mem8[M50_OBJ3_STEP_DIR] & 0x80) !== 0;
  }

  mem8[(slot + OBJ_X) & 0xffff] = 0x07;
  if (overrideX) mem8[(slot + OBJ_X) & 0xffff] = 0xf8;

  mem8[(slot + OBJ_ACTIVE) & 0xffff] = 0x01;
  mem8[(slot + OBJ_SPRITE_CODE) & 0xffff] = 0x4b;
  mem8[(slot + OBJ_HIT_EXTENT_X) & 0xffff] = 0x08;
  mem8[(slot + OBJ_HIT_EXTENT_Y) & 0xffff] = 0x03;

  mem8[OBJ_SPAWN_TIMER] = 0x7c;
  mem8[OBJ_SPAWN_REQ] = 0x00;

  mem8[SPIN_COUNT] = mem8[SPIN_COUNT] - 1;
}
