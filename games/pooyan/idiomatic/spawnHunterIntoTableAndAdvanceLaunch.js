// SPDX-License-Identifier: GPL-3.0-only
import {
  PLAY_MODE_LATCH,
  HUNTER_TABLE_BASE,
  HUNTER_RECORD_PTR,
  LAUNCH_STATE,
  HUNTER_SPAWN_FLIP_FLAG,
  HUNTER_SPAWN_COUNTDOWN,
  HUNTER_SPAWN_SUBCOUNTER,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";
import { loc_0038 } from "./loc_0038.js";
import { u16 } from "../../../core/int.js";
/**
 * spawnHunterIntoTableAndAdvanceLaunch — launch-state-machine state 2: seed a new hunter, then advance the state.
 *
 * Unless the play-mode latch is set, it scans the six hunter records downward one stride
 * apart for the first free one (both leading bytes zero); with no free slot it bails
 * without touching anything. A free slot is stamped with the fixed opening state, coords
 * and tile ids, and its address is recorded. It then bumps the launch state. When the flip
 * flag is clear it seeds the spawn countdown and enqueues a display command; when set it
 * instead advances a sub-counter.
 *
 * LIVE-OUT: memory only — a dispatched state handler whose scratch registers no caller reads.
 */

const HUNTER_SLOT_COUNT = 6;
const HUNTER_RECORD_STRIDE = 0x18; // records step downward by one stride

export function spawnHunterIntoTableAndAdvanceLaunch(m) {
  const { mem8 } = m;

  if (mem8[PLAY_MODE_LATCH] === 0) {
    let rec = HUNTER_TABLE_BASE;
    let free = false;
    for (let n = 0; n < HUNTER_SLOT_COUNT; n++) {
      if (mem8[rec] === 0 && mem8[rec + 0x01] === 0) { free = true; break; }
      rec = u16(rec - HUNTER_RECORD_STRIDE);
    }
    if (!free) return; // no free hunter slot

    mem8[rec + 0x01] = 0x05;
    mem8[rec + 0x02] = 0x10;
    mem8[rec + 0x03] = 0x00;
    mem8[rec + 0x04] = 0x08;
    mem8[rec + 0x05] = 0x00;
    mem8[rec + 0x06] = 0x1a;
    mem8[rec + 0x0f] = 0x37;
    mem8[rec + 0x10] = 0x42;
    mem8[HUNTER_RECORD_PTR] = rec; // record the seeded slot (little-endian)
    mem8[HUNTER_RECORD_PTR + 0x01] = rec >> 8;
  }

  mem8[LAUNCH_STATE] = mem8[LAUNCH_STATE] + 1; // advance the launch state

  if (mem8[HUNTER_SPAWN_FLIP_FLAG] === 0) {
    mem8[HUNTER_SPAWN_COUNTDOWN] = 0x20;
    loc_0038(m, HUNTER_SPAWN_DISPLAY_CMD);
  } else {
    mem8[HUNTER_SPAWN_SUBCOUNTER] = mem8[HUNTER_SPAWN_SUBCOUNTER] + 1;
  }
}
