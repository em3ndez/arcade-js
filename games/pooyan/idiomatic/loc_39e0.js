// SPDX-License-Identifier: GPL-3.0-only
import { launchProjectileIntoFreeSlot } from "./launchProjectileIntoFreeSlot.js";
import { u8 } from "../../../core/int.js";
import {
  WAVE_PROGRESS_COUNTER,
  ROUND_COUNTER,
  GAUGE_PHASE_COUNTER,
  DIFFICULTY_DSW,
  LANE_SPAWN_COUNTDOWN,
  PLAYER_X_COORD,
  FLIP_SCREEN_FLAG,
} from "./names.js";

/**
 * loc_39e0 — gate the enemy "fire / drop" decision on the level counters, then in the shared tail
 * spawn a shot when the derived target column lines up with the actor.
 *
 * High wave progress (>= 0x0e) routes straight to the firing tail; a high round (>= 6) or too-low
 * gauge phase (< 3) diverts through the difficulty gate; late wave (>= 8) also fires. The tail
 * bails on the global lane-spawn countdown and the actor gates, ticks the per-actor cooldown when
 * armed, else derives a column from the launcher X (mirrored on flip) and frame parity and, on a
 * match with the actor's high position (+4), tail-jumps into the shot spawner.
 *
 * LIVE-OUT: none — rets or tail-jumps into the (unlifted) shot spawner; all effect in memory.
 */
export function loc_39e0(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const wave = mem8[WAVE_PROGRESS_COUNTER];
  if (wave >= 0x0e) return l_3a08(m, rec);
  if (mem8[ROUND_COUNTER] >= 0x06) return l_39fb(m, rec);
  if (mem8[GAUGE_PHASE_COUNTER] < 0x03) return l_39fb(m, rec);
  if (wave >= 0x08) return l_3a08(m, rec);
  return l_39fb(m, rec);
}

// l_39fb — extra difficulty gate: hardest DSW or a high actor field (+6) forces / blocks the tail.
function l_39fb(m, rec) {
  const { mem8 } = m;
  if (mem8[DIFFICULTY_DSW] === 0x07) return l_3a08(m, rec);
  if (mem8[rec + 0x06] >= 0x10) return;
  return l_3a08(m, rec);
}

// l_3a08 — the shared firing tail (see the header above); tail-jumps into the shot spawner.
function l_3a08(m, rec) {
  const { mem8 } = m;

  if (mem8[LANE_SPAWN_COUNTDOWN] !== 0) return; // global lane-spawn gate
  if ((mem8[rec + 0x08] & 0xf0) === 0) return; // actor gate
  const cooldown = mem8[rec + 0x15];
  if (cooldown !== 0) {
    mem8[rec + 0x15] = u8(cooldown - 1); // still cooling down
    return;
  }

  const flip = mem8[FLIP_SCREEN_FLAG];
  let col = mem8[PLAYER_X_COORD];
  if (flip === 0) col = u8(-col); // mirror the launcher X when the screen is flipped
  col = ((col >> 3) | (col << 5)) & 0xff; // rrca x3
  col &= 0x1f; // -> column 0..31
  if (flip === 0) col = u8(col - 2);

  let target = col;
  if (mem8[ROUND_COUNTER] & 1) target = u8(target + 4); // odd-frame parity offset
  if (target === mem8[rec + 0x04]) return launchProjectileIntoFreeSlot(m); // tail-jump: spawn a shot
}
