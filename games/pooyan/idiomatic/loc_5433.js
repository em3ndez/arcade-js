// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_4006 } from "./loc_4006.js";
import {
  FORMATION_SPAWN_INDEX,
  ACTOR_MOTION_TABLE_55D4,
  ACTOR_SPEED_TABLE_55D7,
  ACTOR_ANIM_SCRIPT_TABLE_561F,
  ACTOR_ANIM_TABLE_5657,
} from "./names.js";
/**
 * loc_5433 — initialise one enemy formation record at IX.
 *
 * Bails when the record is already live (either of its first two bytes set). Otherwise it stamps the
 * fresh state constants, then draws four values keyed by the shared formation spawn index: a motion
 * byte and a speed byte from the two byte tables (the speed stored as its two's-complement partner),
 * and an animation script byte plus its sequence pointer from the two word tables. It arms the
 * frame-hold, runs one animation tick, and bumps the spawn index so the next record draws the next
 * entry.
 *
 * LIVE-OUT: none in registers — memory only (the record and the spawn index).
 */

export function loc_5433(m, ix = m.regs.ix) {
  const { mem8 } = m;
  if ((mem8[ix] | mem8[ix + 1]) !== 0) return; // record already live

  mem8[ix + 0x00] = 0x01; // active flag
  mem8[ix + 0x02] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x03] = 0x60;
  mem8[ix + 0x04] = 0x1b;
  mem8[ix + 0x0e] = 0x00;

  const index = mem8[FORMATION_SPAWN_INDEX];

  const [motion] = loc_0020(m, ACTOR_MOTION_TABLE_55D4, index);
  mem8[ix + 0x06] = motion;
  const [speed] = loc_0020(m, ACTOR_SPEED_TABLE_55D7, index);
  mem8[ix + 0x0a] = -speed; // two's-complement partner (the store masks)

  const scriptWord = loc_0c45(m, index, ACTOR_ANIM_SCRIPT_TABLE_561F);
  const scriptByte = mem8[scriptWord];
  mem8[ix + 0x17] = scriptByte;
  const sequence = loc_0c45(m, scriptByte, ACTOR_ANIM_TABLE_5657);
  mem8[ix + 0x0c] = sequence; //      low byte (the store masks)
  mem8[ix + 0x0d] = sequence >> 8;

  mem8[ix + 0x11] = 0x40; // frame-hold
  loc_4006(m, ix); //       one animation tick

  mem8[FORMATION_SPAWN_INDEX] = index + 1; // wraps at 256 (the store masks)
}
