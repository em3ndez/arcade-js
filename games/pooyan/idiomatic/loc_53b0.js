// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { u8 } from "../../../core/int.js";
import {
  SPAWN_LATCH,
  FRAME_COUNTER,
  FORMATION_TABLE,
  SPAWN_FIELD_TABLE,
  TURN_COLUMN_LIMIT,
  ANIM_SCRIPT_4203,
  ROUND_COUNTER,
  SPAWN_SPEED_INDEX,
  SPAWN_SPEED_TABLE,
  SPAWN_SPEED_VALUE,
} from "./names.js";
/**
 * loc_53b0 — one-shot spawn/init of the formation record, gated three ways: the incoming byte
 * must be non-zero, the spawn latch clear, and the free-running frame counter at zero. When all
 * hold, it sets the latch, then fills the record — a field byte and its negation from a byte
 * table, fixed opening state/phase/velocity bytes, a cleared turn-column limit, and an armed
 * animation. Finally it derives a speed index from the round counter (halved, +1, clamped to 6)
 * and looks up the matching speed value from a second table.
 *
 * LIVE-OUT: none (memory only). Every exit register is dead — the caller reloads A on return.
 */

const SPEED_INDEX_CLAMP = 0x06; // the derived speed index saturates here
const SPEED_INDEX_CAP = 0x07; //  values at or past this clamp down

export function loc_53b0(m, spawnIndex = m.regs.a) {
  const { mem8 } = m;

  if (spawnIndex === 0) return; //          no descriptor
  if (mem8[SPAWN_LATCH] !== 0) return; //   already spawned
  if (mem8[FRAME_COUNTER] !== 0) return; // only on the frame-counter zero crossing

  mem8[SPAWN_LATCH] = 1;
  const rec = FORMATION_TABLE;

  const [field] = loc_0020(m, SPAWN_FIELD_TABLE, 1);
  mem8[rec + 0x09] = field;
  mem8[rec + 0x0a] = u8(-field); // its two's-complement negation
  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x0b;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x04] = 0x04;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  mem8[TURN_COLUMN_LIMIT] = 0xff; // complement of zero
  setActorAnimation(m, rec, ANIM_SCRIPT_4203);

  let index = (mem8[ROUND_COUNTER] >> 1) + 1;
  if (index >= SPEED_INDEX_CAP) index = SPEED_INDEX_CLAMP;
  mem8[SPAWN_SPEED_INDEX] = index;
  const [speed] = loc_0020(m, SPAWN_SPEED_TABLE, index);
  mem8[SPAWN_SPEED_VALUE] = speed;
}
