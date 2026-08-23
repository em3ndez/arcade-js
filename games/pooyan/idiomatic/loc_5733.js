// SPDX-License-Identifier: GPL-3.0-only
import { adjustSpawnColumn } from "./adjustSpawnColumn.js";
import { loc_0020 } from "./loc_0020.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_57c3 } from "./loc_57c3.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  GAUGE_PHASE_COUNTER,
  SPAWN_COLUMN_BIAS,
  SPAWN_FIELD_TABLE,
  SPAWN_FIELD_TABLE_ODD,
  ENEMY_SPAWN_TIMER,
  SPAWN_TIMER_TABLE_ODD,
  SPAWN_TIMER_TABLE_EVEN,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
} from "./names.js";
/**
 * loc_5733 — initialise one actor slot and spawn it (the spawn body without the slot-live guard).
 *
 * Stamps the record's fresh state/timer/flag fields, then builds a clamped, difficulty- and
 * round-shifted spawn column. That column indexes two round-parity byte tables: the first fills the
 * record's motion field (and its two's-complement partner), the second seeds the spawn timer. The
 * record is pointed at its animation sequence, the active-enemy tally is bumped, then the
 * start-of-scan state machine is entered on the entry seed column.
 *
 * SEATING: caller-skip — the spawn body unwinds past its immediate caller (one actor per scan), so
 * callers place no epilogue after invoking it. Returns nothing.
 * LIVE-OUT: memory only — the initialised record, the spawn timer, and the enemy tally.
 */

const CLAMP_DIFFICULTY = 0x03; // difficulty index ceiling
const GAUGE_BIAS_THRESHOLD = 0x04; // gauge phase at/above this adds the column bias
const COLUMN_MAX = 0x20; // spawn column ceiling (clamped to COLUMN_MAX - 1)

export function loc_5733(m, c = m.regs.c, ix = m.regs.ix, e = m.regs.e) {
  const { mem8 } = m;
  const stateSeed = c; // the entry column; the start-of-scan dispatch reads it after the column work

  // Fresh record fields.
  mem8[ix + 0x00] = 0x01;
  mem8[ix + 0x02] = 0x03;
  mem8[ix + 0x04] = e;
  mem8[ix + 0x03] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x06] = 0x00;
  mem8[ix + 0x08] = 0x00;
  mem8[ix + 0x07] = 0x01;
  mem8[ix + 0x0b] = 0x00;

  const odd = mem8[ROUND_COUNTER] & 0x01;

  // Build the spawn column: clamped difficulty + optional gauge bias + round shift, capped.
  let col = mem8[DIFFICULTY_DSW];
  if (col >= CLAMP_DIFFICULTY) col = CLAMP_DIFFICULTY;
  if (mem8[GAUGE_PHASE_COUNTER] >= GAUGE_BIAS_THRESHOLD) col = (col + mem8[SPAWN_COLUMN_BIAS]) & 0xff;
  if (odd === 0) col = adjustSpawnColumn(m, col); // even round: level-shift clamp
  col = (mem8[ROUND_COUNTER] + col) & 0xff;
  if (col >= COLUMN_MAX) col = COLUMN_MAX - 1;

  // Motion field from the round-parity field table (with its two's-complement partner).
  const fieldTable = odd ? SPAWN_FIELD_TABLE_ODD : SPAWN_FIELD_TABLE;
  const [motion] = loc_0020(m, fieldTable, col);
  mem8[ix + 0x09] = motion;
  mem8[ix + 0x0a] = -motion; // two's-complement partner (Uint8Array store masks)

  setActorAnimation(m, ix, ANIM_TABLE_3829);

  // Spawn timer from the round-parity timer table.
  const timerTable = odd ? SPAWN_TIMER_TABLE_ODD : SPAWN_TIMER_TABLE_EVEN;
  const [timer] = loc_0020(m, timerTable, col);
  mem8[ENEMY_SPAWN_TIMER] = timer;

  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;

  loc_57c3(m, stateSeed); // enter the start-of-scan state machine
}
