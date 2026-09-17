// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnRequestedFireAndRecolorLiveFires — sweep the five fire slots: count the live ones,
 * recolour each, service one pending spawn request, and skip the caller when the array is empty.
 *
 * Walks the five OBJ_ARRAY_64 records (stride 0x20). A live record is tallied and its
 * sprite-attr flagged (forced off while Mario swings a hammer). An empty record may honour a
 * raised insert request (EVENT_REQ_313C == 1), activating the slot and bumping the count.
 *
 * The 50m early exit is an EXACT equality (DIFFICULTY == running count), not a population cap:
 * the count is bumped at live records but tested only at empty ones, so it can step past
 * DIFFICULTY without the test seeing the boundary. On that exit the request is NOT cleared.
 *
 * The return value replaces a stack-splice: true = normal return, false = skip the caller,
 * taken only when the array is wholly empty.
 *
 * LIVE-OUT: OBJ_LIVE_COUNT, EVENT_REQ_313C, the per-record fields, plus the caller-skip boolean.
 */

import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_SPRITE_ATTR,
  OBJ_INSERT_REQUESTED,
  OBJ_LIVE_COUNT,
  BOARD,
  DIFFICULTY,
  MARIO_HAMMER_ACTIVE,
  EVENT_REQ_313C,
} from "./names.js";

export function spawnRequestedFireAndRecolorLiveFires(m) {
  const { mem8 } = m;

  let count = 0;
  mem8[OBJ_LIVE_COUNT] = count;

  let ix = OBJ_ARRAY_64;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem8[(ix + OBJ_ACTIVE) & 0xffff] !== 0) {
      count = (count + 1) & 0xff;
      mem8[OBJ_LIVE_COUNT] = count;
      const hammerHeld = mem8[MARIO_HAMMER_ACTIVE] === 0x01;
      mem8[(ix + OBJ_SPRITE_ATTR) & 0xffff] = hammerHeld ? 0x00 : 0x01;
      continue;
    }

    // Unreachable from this entry (count is 4 or less at any empty slot), kept for fidelity.
    if (count === 0x05) continue;

    // Exact-equality early exit, and it leaves the request uncleared. Off 50m the DIFFICULTY
    // read never happens.
    if (mem8[BOARD] === 0x02 && mem8[DIFFICULTY] === count) return true;

    if (mem8[EVENT_REQ_313C] === 0x01) {
      mem8[(ix + OBJ_ACTIVE) & 0xffff] = 0x01;
      mem8[(ix + OBJ_INSERT_REQUESTED) & 0xffff] = 0x01;
      mem8[EVENT_REQ_313C] = 0x00;
      count = (count + 1) & 0xff;
      mem8[OBJ_LIVE_COUNT] = count;
    }
  }

  mem8[EVENT_REQ_313C] = 0x00;
  return count !== 0;
}
