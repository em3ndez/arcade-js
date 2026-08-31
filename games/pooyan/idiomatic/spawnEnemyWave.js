// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceActorAnimationsUnlessGrabbing } from "./advanceActorAnimationsUnlessGrabbing.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ACTOR_TABLE,
  ENEMY_ACTOR_TABLE,
  PLAY_MODE_LATCH,
  ROUND_COUNTER,
  TILE_ANIM_CURSOR,
  FLIP_SCREEN_FLAG,
  ANIM_SCRIPT_CURSOR,
  GAME_ACTIVE_FLAG,
  LAUNCH_ARMED_FLAG,
  PLAY_STATE_INDEX,
  DISPLAY_MSG_BUF,
  TARGET_GROUP_COUNT,
  ANIM_TABLE_3829,
  WAVE_SEED_TABLE_1E34,
  WAVE_SEED_TABLE_1E2C,
  WAVE_TILE_CURSOR_84F6,
  WAVE_TILE_CURSOR_84E9,
  ANIM_SCRIPT_26C9,
  INTRO_MSG_STRING_183F,
  SPAWN_TILE_TABLE_70EB,
} from "./names.js";
/**
 * spawnEnemyWave — play-state idx3 handler: enemy-wave setup + spawn.
 *
 * Picks a seed table and a tile-anim cursor from the play-mode latch and round parity, publishes
 * the cursor to TILE_ANIM_CURSOR, and seeds four actor records at ACTOR_TABLE (start flag + two
 * table bytes each). Unflipped, it nudges record 0's +6 field down two. It seats the shared
 * anim-script cursor and steps the actor animators. Then, on PLAY_MODE_LATCH: the zero branch
 * either arms play-state 0x12 or copies a 0x43-terminated string (biased -0x88) into
 * DISPLAY_MSG_BUF; the nonzero branch fans out an ENEMY_ACTOR_TABLE sprite group (size from the
 * round, tile base via a word-table lookup, per-slot coord packing) and arms play-state 0x0f.
 *
 * LIVE-OUT: none — a void state handler; all effect lands in work RAM.
 */

const SEED_COUNT = 4; // actor records seeded
const RECORD_STRIDE = 0x18; // actor-record pitch

export function spawnEnemyWave(m) {
  const { mem8, mem16 } = m;

  // Select the seed table (HL) + tile-anim cursor (DE) by the latch/round parity, publish the cursor.
  let seedTable, animCursor;
  if (mem8[PLAY_MODE_LATCH] !== 0) {
    seedTable = WAVE_SEED_TABLE_1E34;
    animCursor = WAVE_TILE_CURSOR_84E9;
  } else if ((mem8[ROUND_COUNTER] & 0x01) !== 0) { // odd round
    seedTable = WAVE_SEED_TABLE_1E2C;
    animCursor = WAVE_TILE_CURSOR_84F6;
  } else { // even round
    seedTable = WAVE_SEED_TABLE_1E34;
    animCursor = WAVE_TILE_CURSOR_84E9;
  }
  mem16[TILE_ANIM_CURSOR] = animCursor;

  // Seed four actor records: start flag + {+4,+6} pulled from the selected table.
  let rec = ACTOR_TABLE;
  let src = seedTable;
  for (let i = 0; i < SEED_COUNT; i++) {
    mem8[rec] = 0x01;
    mem8[rec + 0x04] = mem8[src]; src = u16(src + 1);
    mem8[rec + 0x06] = mem8[src]; src = u16(src + 1);
    rec = u16(rec + RECORD_STRIDE);
  }

  if (mem8[FLIP_SCREEN_FLAG] === 0) { // unflipped: nudge record 0's +6 field down two
    mem8[ACTOR_TABLE + 0x06] = u8(mem8[ACTOR_TABLE + 0x06] - 2);
  }

  // Seat the shared anim-script cursor, then step the animators.
  mem16[ANIM_SCRIPT_CURSOR] = ANIM_SCRIPT_26C9;
  advanceActorAnimationsUnlessGrabbing(m);

  if (mem8[PLAY_MODE_LATCH] === 0) {
    // Zero branch: arm play-state 0x12, else bump it and copy the intro string.
    if (mem8[GAME_ACTIVE_FLAG] === 0 && mem8[LAUNCH_ARMED_FLAG] !== 0) {
      mem8[PLAY_STATE_INDEX] = 0x12;
      return;
    }
    mem8[PLAY_STATE_INDEX] = u8(mem8[PLAY_STATE_INDEX] + 1);
    let s = INTRO_MSG_STRING_183F;
    let dst = DISPLAY_MSG_BUF;
    for (;;) {
      const ch = mem8[s];
      if (ch === 0x43) return; // 'C' terminator ends the copy
      mem8[dst] = u8(ch - 0x88); // biased copy
      s = u16(s + 1);
      dst = u16(dst + 1);
    }
  }

  // Nonzero branch (block C): fan out the sprite group when round bit 1 is set.
  if ((mem8[ROUND_COUNTER] & 0x02) !== 0) {
    const half = mem8[ROUND_COUNTER] >> 1;
    let groupSize, tileIndex;
    if (half < 0x07) {
      tileIndex = (half >> 1) & 0x03;
      groupSize = tileIndex + 0x05;
    } else { // saturate
      groupSize = 0x08;
      tileIndex = 0x03;
    }
    mem8[TARGET_GROUP_COUNT] = groupSize;
    const word = fetchWordFromTableIndex(m, tileIndex, SPAWN_TILE_TABLE_70EB); // tile-base word (was HL)
    let hi = (word >> 8) & 0xff;
    const lo = word & 0xff;
    let cAcc = 0x00;
    let slot = ENEMY_ACTOR_TABLE;
    for (let i = 0; i < groupSize; i++) {
      mem8[slot + 0x05] = 0x80;
      mem8[slot] = 0x01;
      mem8[slot + 0x06] = 0x04;
      mem8[slot + 0x04] = hi;
      hi = u8(hi + (lo & 0x0f));
      const sum = cAcc + (lo & 0xf0);
      cAcc = sum & 0xff;
      mem8[slot + 0x03] = cAcc;
      if (sum > 0xff) { // carry ripples into the tile high byte
        mem8[slot + 0x04] = u8(mem8[slot + 0x04] + 1);
        hi = u8(hi + 1);
      }
      setActorAnimation(m, slot, ANIM_TABLE_3829);
      slot = u16(slot + RECORD_STRIDE);
    }
  }
  mem8[PLAY_STATE_INDEX] = 0x0f;
}
