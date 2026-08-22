// SPDX-License-Identifier: GPL-3.0-only
import { loc_34b0 } from "./loc_34b0.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_0020 } from "./loc_0020.js";
import {
  TURN_COLUMN_LIMIT,
  PLAY_STATE_INDEX,
  ANIM_ARMED_LATCH,
  SPAWN_PHASE_SNAPSHOT,
  ANIM_TABLE_3838,
  ANIM_TABLE_3418,
  SPRITE_BAND_86E3,
} from "./names.js";
/**
 * loc_343e — object X-movement handler for the record based at IX.
 *
 * Advances the sub-position (rec+0x05) by the per-frame delta (rec+0x09); an overflow carries
 * into the tile column (rec+0x06). It then compares the masked column against the turn-column
 * limit: below the limit it just returns; above it it flags the record and arms the turn-around
 * animation. At the limit it gates on the play sub-state and the delta, and when
 * those pass it either latches the record (when the band is already armed) or, on the first arm,
 * bumps the capped animation phase, looks up the new turn-column limit, stamps the interior sprite
 * band, sets the armed latch, and tails into the shared despawn-movement handler.
 *
 * LIVE-OUT: none — the caller reloads A from memory right after the call and reads no other
 * register back; every effect is in memory (record fields, the limit/latch, the band).
 */
const COLUMN_MASK = 0x1f;
const PLAY_STATE_ARM = 0x04; //  play sub-state that permits the band arm
const PHASE_TAIL_AT = 0x07; //   phase at/above which the arm short-circuits into the despawn tail
const PHASE_CAP = 0x0a; //       phase inc is guarded below this (phase is always < 7 here)
const BAND_ROW = 0x20; //        one tilemap row between the band's two tile pairs
const BAND_TILES = [0xd8, 0xd9, 0xda, 0xdb]; // the four interior-band tile codes

export function loc_343e(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const sum = mem8[rec + 0x05] + mem8[rec + 0x09];
  if (sum > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1; // column carry
  mem8[rec + 0x05] = sum;
  const advanced = sum & 0xff; // the stored sub-position, reused as the delta gate below

  const limit = mem8[TURN_COLUMN_LIMIT];
  const maskedColumn = mem8[rec + 0x06] & COLUMN_MASK;
  if (maskedColumn < limit) return; //                     not yet at the turn column

  if (maskedColumn > limit) { //                           past the turn column: arm the turn-around
    mem8[rec + 0x08] = 0x01;
    return setActorAnimation(m, rec, ANIM_TABLE_3838);
  }

  // maskedColumn === limit
  if (maskedColumn === 0) return loc_34b0(m, rec); //      limit 0: straight to the despawn tail
  if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_ARM) return;
  if (mem8[rec + 0x09] < advanced) return; //              delta below the advanced position

  if (mem8[ANIM_ARMED_LATCH] !== 0) { //                   band already built: just latch the record
    mem8[rec + 0x01] = 0x01;
    return;
  }

  // First arm: bump the capped phase, look up the new limit, stamp the band, set the latch.
  mem8[rec + 0x01] = 0x00;
  let phase = mem8[SPAWN_PHASE_SNAPSHOT];
  if (phase >= PHASE_TAIL_AT) return loc_34b0(m, rec);
  if (phase < PHASE_CAP) mem8[SPAWN_PHASE_SNAPSHOT] = phase + 1; // always fires (phase < 7)
  phase = mem8[SPAWN_PHASE_SNAPSHOT];

  const [newLimit] = loc_0020(m, ANIM_TABLE_3418, phase); // table lookup indexed by phase
  mem8[TURN_COLUMN_LIMIT] = newLimit;

  mem8[SPRITE_BAND_86E3 + 0x00] = BAND_TILES[0];
  mem8[SPRITE_BAND_86E3 + 0x01] = BAND_TILES[1];
  mem8[SPRITE_BAND_86E3 + BAND_ROW + 0x00] = BAND_TILES[2];
  mem8[SPRITE_BAND_86E3 + BAND_ROW + 0x01] = BAND_TILES[3];
  mem8[ANIM_ARMED_LATCH] = 0x01;

  return loc_34b0(m, rec);
}
