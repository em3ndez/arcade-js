// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnRequestedFireAndRecolorLiveFires — sweep the five fire slots: count the live ones, recolour
 * each of them, service one pending spawn request, and splice the caller when the array is empty.
 *
 * Walks the five OBJ_ARRAY_64 records (stride 0x20) and tallies the non-empty ones into
 * OBJ_LIVE_COUNT. For each LIVE record it flags that record's OBJ_SPRITE_ATTR on, or off while Mario
 * is swinging a hammer. For each EMPTY record it may honour a pending insert request
 * EVENT_REQ_313C: off 50m, or on 50m while the difficulty ramp does not equal the running count, a
 * raised request (== 1) activates that free slot — OBJ_ACTIVE and OBJ_INSERT_REQUESTED both set to
 * 1 — consumes the request, and bumps the count. On 50m the routine instead returns early, and
 * normally, the instant DIFFICULTY equals the running count; on that exit the request is
 * deliberately NOT cleared.
 *
 * THE 50m EARLY EXIT IS AN EXACT EQUALITY, NOT A POPULATION CAP. It is tested only at EMPTY records
 * while the count is bumped at LIVE ones, so the count can step straight PAST DIFFICULTY without the
 * test ever seeing the boundary: with DIFFICULTY 2 and the records live / live / live / empty, the
 * count is already 3 when the first empty slot is reached, and the insert is allowed. "It stops
 * inserting once the live count reaches DIFFICULTY" is a misreading of this arm — the exit fires
 * only on the exact hit.
 *
 * After the scan it clears the insert request and inspects the count: a non-zero count returns
 * normally, a ZERO count takes the caller-skip SPLICE. In the raw form that splice discards the
 * caller's return address and returns a level up, skipping the rest of the object pass the caller
 * runs. Here the stack manipulation is gone and the decision IS the return value, consumed as
 * `if (!spawnRequestedFireAndRecolorLiveFires(m)) return;` — true = normal return, false = caller
 * spliced.
 *
 * Self-contained: reads and writes only work RAM, calls nothing.
 *
 * WHAT THE NAME CLAIMS. SPAWN is derivable right here — the activation write in the insert arm is
 * what turns an empty slot into a live one, and no other write in this file does that. That the
 * array holds the FIRES is carried with the name from evidence outside this file. One arm cannot be
 * reached from this entry at all: an empty slot with the count already at 5, since the count starts
 * at 0 and rises at most once across the five records, so it is 4 or less at any empty slot. It is
 * kept anyway, so the control flow stays faithful.
 *
 * Reads: the five records' OBJ_ACTIVE, MARIO_HAMMER_ACTIVE, BOARD, DIFFICULTY, EVENT_REQ_313C.
 * Writes: OBJ_LIVE_COUNT, EVENT_REQ_313C, and the per-record OBJ_ACTIVE / OBJ_SPRITE_ATTR /
 * OBJ_INSERT_REQUESTED fields.
 * LIVE-OUT: those writes, plus the caller-skip boolean.
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
  const { mem } = m;

  let count = 0;
  mem.write8(OBJ_LIVE_COUNT, count); // counter := 0

  let ix = OBJ_ARRAY_64;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem.read8((ix + OBJ_ACTIVE) & 0xffff) !== 0) {
      // Live record: tally it and flag its sprite-attr field (forced off while a hammer swings).
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
      const hammerHeld = mem.read8(MARIO_HAMMER_ACTIVE) === 0x01;
      mem.write8((ix + OBJ_SPRITE_ATTR) & 0xffff, hammerHeld ? 0x00 : 0x01);
      continue;
    }

    // Empty record. (count === 5 here cannot be reached from the entry — structurally the count
    // is 4 or less at any empty slot — but the guard is kept so the dead arm stays faithful.)
    if (count === 0x05) continue;

    // On 50m, the instant the difficulty ramp equals the running count, return normally —
    // WITHOUT clearing the pending request. The short-circuit is faithful: off 50m the
    // DIFFICULTY read never happens at all.
    if (mem.read8(BOARD) === 0x02 && mem.read8(DIFFICULTY) === count) return true;

    // Otherwise honour a pending INSERT request (== 1) into this free slot.
    if (mem.read8(EVENT_REQ_313C) === 0x01) {
      mem.write8((ix + OBJ_ACTIVE) & 0xffff, 0x01); // activate the slot
      mem.write8((ix + OBJ_INSERT_REQUESTED) & 0xffff, 0x01);
      mem.write8(EVENT_REQ_313C, 0x00); // consume the request
      count = (count + 1) & 0xff;
      mem.write8(OBJ_LIVE_COUNT, count);
    }
  }

  // Clear the INSERT request latch, then take the caller-skip only on a wholly empty array.
  mem.write8(EVENT_REQ_313C, 0x00);
  return count !== 0; // true = normal return; false = SPLICE past the caller
}
