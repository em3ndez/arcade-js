// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ROUND_COUNTER, DIFFICULTY_DSW, STAGE_COUNTDOWN, ACTOR_ATTR_BASE_TABLE, ACTOR_ATTR_MERGE_TABLE } from "./names.js";
/**
 * mergeActorAttributeByte — build an actor's attribute byte (record +0x08) from two lookup tables.
 *
 * The primary table is indexed by 2*difficulty plus the round counter clamped to 0x0e. That base
 * value is stepped down past the record's +0x16/+0x13 bit-0 flags and its +0x06 phase (each armed
 * gate decrements it, +0x06 below 9 up to twice; a value reaching zero stops early), biased up by
 * 3 when the stage countdown is below 4, then the merge table indexed by it is OR-ed into +0x08.
 *
 * LIVE-OUT: memory only — the +0x08 byte; the tail successor discards A/B/HL and C is untouched.
 */
export function mergeActorAttributeByte(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const round = mem8[ROUND_COUNTER];
  const clampedRound = round < 0x10 ? round : 0x0e;
  const index = (mem8[DIFFICULTY_DSW] * 2 + clampedRound) & 0xff;
  let value = fetchByteFromTableIndex(m, ACTOR_ATTR_BASE_TABLE, index)[0];

  let zeroed = false;
  if ((mem8[rec + 0x16] & 1) !== 0) {
    value = (value - 1) & 0xff;
    if (value === 0) zeroed = true;
    else if ((mem8[rec + 0x13] & 1) !== 0) {
      value = (value - 1) & 0xff;
      if (value === 0) zeroed = true;
    }
  }
  if (!zeroed && mem8[rec + 0x06] < 0x09) {
    value = (value - 1) & 0xff;
    if (value !== 0) value = (value - 1) & 0xff;
  }
  if (mem8[STAGE_COUNTDOWN] < 0x04) value = (value + 0x03) & 0xff;

  mem8[rec + 0x08] = fetchByteFromTableIndex(m, ACTOR_ATTR_MERGE_TABLE, value)[0] | mem8[rec + 0x08];
}
