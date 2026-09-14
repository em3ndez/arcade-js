// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SPAWN_TIMER_RELOAD, FLYER_SLOT_TOP, PLAYER_FINE_ANGLE, ENEMY_SLOT_FLAGS, ENEMY_SLOT_DIR, ENEMY_TIMER, loc_2b5, ENEMY_SEGMENT,
  loc_2c8, ENEMY_PHASE, loc_2db, ENEMY_DEPTH, POKEY1_RANDOM, ACTIVE_ENEMY_COUNT, SPAWN_RATE_TABLE,
} from "./names.js";
import { gateSound8f } from "./gateSound8f.js";

// Walk the seven source slots: for each armed, above-threshold slot whose timer
// underflows and whose RNG roll beats the per-wave gate, copy its spawn fields
// into the first free destination slot, reseed the timer, and cue the sound.
export function spawnClimbersFromSourceSlots(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;
  for (let x = 6; x >= 0; x--) {
    if (mem8[u16(ENEMY_DEPTH + x)] === 0) continue;
    if (mem8[u16(ENEMY_DEPTH + x)] < 0x30) continue;
    if ((mem8[u16(ENEMY_SLOT_DIR + x)] & 0x40) === 0) continue;
    const dec = u8(mem8[u16(ENEMY_TIMER + x)] - 1);
    mem8[u16(ENEMY_TIMER + x)] = dec;
    if ((dec & 0x80) === 0) continue; // fires only when the timer underflows
    mem8[u16(ENEMY_TIMER + x)] = u8(dec + 1); // restore it
    if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) continue;
    if (mem8[POKEY1_RANDOM] < mem8[u16(SPAWN_RATE_TABLE + mem8[ACTIVE_ENEMY_COUNT])]) continue;
    let y = mem8[FLYER_SLOT_TOP];
    while (true) {
      if (mem8[u16(loc_2db + y)] === 0) {
        mem8[u16(loc_2db + y)] = mem8[u16(ENEMY_DEPTH + x)];
        mem8[u16(loc_2b5 + y)] = mem8[u16(ENEMY_SEGMENT + x)];
        mem8[u16(loc_2c8 + y)] = mem8[u16(ENEMY_PHASE + x)];
        mem8[u16(ENEMY_TIMER + x)] = mem8[SPAWN_TIMER_RELOAD];
        gateSound8f(m, x, y);
        mem8[ACTIVE_ENEMY_COUNT] = u8(mem8[ACTIVE_ENEMY_COUNT] + 1);
        y = 0; // spawned -> end the free-slot scan
      }
      y = u8(y - 1);
      if (y & 0x80) break;
    }
  }
}
