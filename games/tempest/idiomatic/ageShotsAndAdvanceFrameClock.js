// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  GAME_MODE, STATUS_FLAGS, DSW1_SNAPSHOT, loc_3d, loc_40, loc_42, SLOT_COUNTDOWN, INPUT_DEBOUNCED, DEPTH_LO, DEPTH_HI,
  ACTIVE_ENEMY_COUNT, SPIKE_ACTIVE_FLAG, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, loc_10f, REDRAW_COUNTER, TIMED_OBJECT_COUNT, PLAYER_SHAPE_SUM, ENEMY_SLOT_TOP,
  ACTIVE_OBJECT_COUNT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, ENEMY_DEPTH, FIRE_GATE, loc_455,
} from "./names.js";
import { clearActiveShots } from "./clearActiveShots.js";
import { initWaveStateCountingSpikes } from "./initWaveStateCountingSpikes.js";

// A control byte's sign splits two arms: the positive arm bumps a per-slot timer
// cell and conditionally resets shot state; the negative arm ages the shot table,
// advances a clock, and clamps a running total.
export function ageShotsAndAdvanceFrameClock(m) {
  const { mem8 } = m;

  if (mem8[PLAYER_FINE_ANGLE] < 0x80) {
    // ----- positive arm -----
    // Bump the timer cell only when a gate is live and a limit is not yet reached.
    if ((mem8[loc_455] | mem8[PLAYER_SHAPE_SUM]) !== 0 && 0x17 < mem8[loc_42]) {
      const x = mem8[loc_40];
      mem8[u8(GAME_MODE + x)] = u8(mem8[u8(GAME_MODE + x)] + 1);
    }
    if (mem8[SPIKE_ACTIVE_FLAG] !== 0) return;
    if ((mem8[FIRE_GATE] | mem8[TIMED_OBJECT_COUNT]) === 0) {
      // Reset unless any live shot has already grown past the threshold.
      let y = mem8[ENEMY_SLOT_TOP];
      let anyBig = false;
      for (;;) {
        const v = mem8[u16(ENEMY_DEPTH + y)];
        if (v !== 0 && v >= 0x11) { anyBig = true; break; }
        y = u8(y - 1);
        if (y >= 0x80) break;
      }
      if (!anyBig) { initWaveStateCountingSpikes(m); clearActiveShots(m); }
    }
    if ((mem8[INPUT_DEBOUNCED] & 0x60) === 0) return;
    if ((mem8[STATUS_FLAGS] & 0x80) === 0) return;
    if ((mem8[DSW1_SNAPSHOT] & 0x43) !== 0x40) return;
    initWaveStateCountingSpikes(m);
    return;
  }

  // ----- negative arm -----
  if ((mem8[ACTIVE_OBJECT_COUNT] | mem8[ACTIVE_ENEMY_COUNT] | mem8[TIMED_OBJECT_COUNT]) !== 0) return;
  // Age each live shot by a fixed step, snapping to zero at the ceiling.
  for (let x = mem8[ENEMY_SLOT_TOP]; ; ) {
    const cur = mem8[u16(ENEMY_DEPTH + x)];
    if (cur !== 0) {
      const v = cur + 0x0f;
      mem8[u16(ENEMY_DEPTH + x)] = v >= 0xf0 ? 0x00 : v;
    }
    x = u8(x - 1);
    if (x >= 0x80) break;
  }

  let proceed;
  const idx = mem8[loc_3d];
  if (mem8[u8(SLOT_COUNTDOWN + idx)] !== 0x01) {
    // Advance one counter; proceed once it crosses the ceiling.
    const v = mem8[PLAYER_SHOT_DEPTH] + 0x0f;
    mem8[PLAYER_SHOT_DEPTH] = u8(v);
    proceed = v >= 0xf0;
  } else {
    // Reset two flags and step a 16-bit clock down; proceed at a marker value.
    mem8[loc_10f] = 0x00;
    mem8[REDRAW_COUNTER] = 0x01;
    const lo = mem8[DEPTH_HI] - 0x20;
    mem8[DEPTH_HI] = u8(lo);
    const hi = mem8[DEPTH_LO] - (lo < 0 ? 1 : 0);
    mem8[DEPTH_LO] = u8(hi);
    proceed = u8(hi) === 0xfa;
  }
  if (!proceed) return;

  mem8[GAME_MODE] = 0x06;
  clearActiveShots(m);
  const sum = u8(mem8[ENEMY_TOTAL_COUNT] + mem8[ENEMY_TYPE_COUNT] + mem8[FIRE_GATE]);
  mem8[FIRE_GATE] = sum >= 0x3f ? 0x3f : sum;
}
