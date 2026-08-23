// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand06 } from "./queueSoundCommand06.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_64be } from "./loc_64be.js";
import {
  PLAY_MODE_LATCH,
  FLIP_SCREEN_FLAG,
  SPRITE_TARGET_SLOTS,
  SPRITE_TARGET_SLOTS_P1,
  SPAWN_OBJECT_TABLE,
  PROJECTILE_TABLE,
  OBJ_HIT_FLAG_I0,
  OBJ_HIT_FLAG_I1,
  HIT_TALLY,
  HUNTER_SPAWN_DISPLAY_CMD,
  ANIM_SEQ_64DF,
  TERMINATOR_SCAN_SRC,
  TERMINATOR_MATCH_TABLE,
} from "./names.js";

const SCAN_SLOTS = 3; // records tested per pass
const COORD_STRIDE = 0x04; // between coordinate slots
const RECORD_STRIDE = 0x18; // between object records
const NEAR_LIMIT = 0x07; // a hit needs the axis magnitude below this
const Y_BIAS = 0x08; // added to both actor and object Y before comparing
const X_BIAS_NORMAL = 0xfe; // object-X bias when not flipped (-2)
const X_BIAS_FLIPPED = 0x05; // object-X bias when flipped (+5)

/**
 * loc_6435 — proximity/collision scan for one actor record (dissolved skip).
 *
 * Picks the object set by PLAY_MODE_LATCH, then tests up to three records: a record
 * hits when it is active and its biased X and Y both sit within NEAR_LIMIT of the actor
 * coordinates. No hit returns true, so the caller keeps scanning. A hit resets the
 * struck record, raises the I-parity hit flag selected by regI, restarts its animation,
 * queues the hit effect and (in one-player play) a hunter-spawn command, bumps
 * HIT_TALLY, then runs a terminator guard whose abort propagates as a false return.
 *
 * LIVE-OUT: none in registers — the caller resumes on its own preserved state. Memory:
 * the struck record, its hit flag and animation fields, HIT_TALLY, the effect rings.
 */
function farOnAxis(actorVal, objVal) {
  let d = (actorVal - objVal) & 0xff;
  if (actorVal < objVal) d = (0 - d) & 0xff; // borrow -> magnitude
  return d >= NEAR_LIMIT;
}

export function loc_6435(m, iy = m.regs.iy, regI = m.regs.i) {
  const { mem8 } = m;

  let coord;
  let record;
  if (mem8[PLAY_MODE_LATCH] === 0) {
    coord = SPRITE_TARGET_SLOTS_P1;
    record = SPAWN_OBJECT_TABLE;
  } else {
    coord = SPRITE_TARGET_SLOTS;
    record = PROJECTILE_TABLE;
  }

  let hit = -1;
  for (let n = 0; n < SCAN_SLOTS; n++) {
    if (mem8[record] !== 0) {
      const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_FLIPPED : X_BIAS_NORMAL;
      const objX = (mem8[coord] + xBias) & 0xff;
      const objY = (mem8[coord + 2] + Y_BIAS) & 0xff;
      if (!farOnAxis(mem8[iy], objX) && !farOnAxis((mem8[iy + 2] + Y_BIAS) & 0xff, objY)) {
        hit = record;
        break;
      }
    }
    coord = u16(coord + COORD_STRIDE);
    record = u16(record + RECORD_STRIDE);
  }

  if (hit < 0) return true; // no collision -> caller keeps its scan loop running

  mem8[hit] = 0x00;
  mem8[hit + 1] = 0x01;
  mem8[hit + 2] = 0x02;
  mem8[u16(hit + 0x11)] = 0x20;
  mem8[regI === 0 ? OBJ_HIT_FLAG_I0 : OBJ_HIT_FLAG_I1] = 0x01;
  setActorAnimation(m, hit, ANIM_SEQ_64DF);
  queueSoundCommand06(m);
  if (mem8[PLAY_MODE_LATCH] === 0) loc_0038(m, HUNTER_SPAWN_DISPLAY_CMD);
  mem8[HIT_TALLY] = mem8[HIT_TALLY] + 1;
  return loc_64be(m, TERMINATOR_SCAN_SRC, TERMINATOR_MATCH_TABLE); // always false -> abort caller
}
