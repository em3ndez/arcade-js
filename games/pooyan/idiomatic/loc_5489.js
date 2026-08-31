// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ACTOR_ANIM_TABLE_5657, ACTOR_SPEED_TABLE_55D7, ROUND_COUNTER } from "./names.js";
/**
 * loc_5489 — initialise an actor record at rec.
 *
 * Seeds the opening field bytes (active flag, cleared state/phase, a fixed 0x60/0x1b pair, the
 * caller's spawn field), then looks up the record's animation sequence from the pointer table by its
 * kind byte (rec+0x17) and installs it. Finally it seats the dwell countdown and derives a signed
 * speed for rec+0x0a: the kind byte indexes a row of the speed table, then 3x the low round-counter
 * bits index into that row, and the fetched byte is negated.
 *
 * SEATING: caller-skip (pop af; ret) — dissolved to a boolean the caller early-returns on; it always
 * skips, so it always returns false. LIVE-OUT: none (memory only); every exit register is dead.
 */

const ACTIVE_FLAG = 0x00; //    rec+0x00 = 1 (active)
const STATE_FIELD = 0x02; //    rec+0x02 = 0
const PHASE_FIELD = 0x05; //    rec+0x05 = 0
const FIXED_60 = 0x03; //       rec+0x03 = 0x60
const FIXED_1B = 0x04; //       rec+0x04 = 0x1b
const SPAWN_FIELD = 0x06; //    rec+0x06 = caller byte
const KIND_FIELD = 0x17; //     rec+0x17 = animation / speed kind index
const COUNTDOWN = 0x11; //      rec+0x11 = 0x40
const SPEED_FIELD = 0x0a; //    rec+0x0a = the negated speed
const COUNTDOWN_SEED = 0x40;
const ROUND_MASK = 0x07;

export function loc_5489(m, rec = m.regs.ix, spawnField = m.regs.b) {
  const { mem8 } = m;

  mem8[rec + ACTIVE_FLAG] = 0x01;
  mem8[rec + STATE_FIELD] = 0x00;
  mem8[rec + PHASE_FIELD] = 0x00;
  mem8[rec + FIXED_60] = 0x60;
  mem8[rec + FIXED_1B] = 0x1b;
  mem8[rec + SPAWN_FIELD] = spawnField;

  const kind = mem8[rec + KIND_FIELD];
  const animPointer = fetchWordFromTableIndex(m, kind, ACTOR_ANIM_TABLE_5657);
  setActorAnimation(m, rec, animPointer);
  mem8[rec + COUNTDOWN] = COUNTDOWN_SEED;

  // kind picks the speed-table row; 3 x (round & 7) picks the byte within it, negated
  const [, speedRow] = fetchByteFromTableIndex(m, ACTOR_SPEED_TABLE_55D7, kind);
  const step = 3 * (mem8[ROUND_COUNTER] & ROUND_MASK);
  const [speed] = fetchByteFromTableIndex(m, speedRow, step);
  mem8[rec + SPEED_FIELD] = u8(-speed);

  return false;
}
