// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_313c — scan the five 0x6400 object slots, count the live ones, service one pending
 *            INSERT request, and splice the caller when the array is empty.  ROM 0x313C.
 *
 * Walks the five OBJ_ARRAY_64 records (stride 0x20 from 0x6400) and tallies the non-empty
 * ones into the scratch counter 0x63A1. For each LIVE record it flags the record's +8 field
 * on (0x01), or off (0x00) while Mario is swinging a hammer. For each EMPTY record it may
 * honour a pending object-INSERT request (EVENT_REQ_313C, 0x63A0): off 50m, or on 50m once the
 * difficulty ramp no longer equals the running count, a raised request (== 1) activates that
 * free slot (+0 and +0x18 := 1), consumes the request, and bumps the count. On 50m the routine
 * returns early — normally — the instant DIFFICULTY equals the running count (and, on that early
 * exit, the request is deliberately NOT cleared).
 *
 * After the scan it clears the INSERT request and inspects the count: a non-zero count returns
 * normally, but a ZERO count (no live objects, no insert) takes the caller-skip SPLICE. In the
 * raw Z80 the splice discards its caller's return address (inc sp ×2 / ret) and returns a level
 * up, skipping the rest of the untranslated orchestrator entry_30ed. The idiomatic form drops the
 * stack manipulation (the Z80 stack is the JS call stack) and returns the decision as a boolean
 * the caller consumes as `if (!loc_313c(m)) return;` — true = normal return, false = caller spliced.
 *
 * Self-contained: reads/writes only work RAM, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-313c.test.js.
 * GATE:     crafted-entry — the input space (5 slot flags × BOARD × DIFFICULTY × request ×
 *           hammer) is too large to sweep whole, so entries are crafted to cover every branch
 *           and arm (both early-normal-return paths, the INSERT arm, the hammer-off arm, and
 *           BOTH the counter!=0 normal return and the counter==0 SPLICE), backed by a structured
 *           cross-product sweep. loc_313c is on no live dispatch path — its only caller, the
 *           untranslated orchestrator 0x30ED, is never reached — so there are no natural
 *           dispatches to capture; the crafted entries + sweep are the whole proof. The
 *           counter==5 empty-slot arm is UNREACHABLE from the entry (the count resets to 0 and
 *           rises at most once across the five records, so it is <= 4 at any empty slot), leaving
 *           that arm dead on both sides — no entry can drive it.
 * LIVE-OUT: memory-only + the boolean skip decision. Writes 0x63A1 (count), EVENT_REQ_313C, and
 *           per-record +0/+8/+0x18 fields; the residual registers/flags and the Z80's two-level
 *           return are the dead skip mechanism, replaced by the boolean the caller reloads past.
 * NAMES:    OBJ_ARRAY_64 (0x6400), OBJ_ACTIVE (+0), OBJ_SPRITE_ATTR (+8), BOARD (0x6227),
 *           DIFFICULTY (0x6380), MARIO_HAMMER_ACTIVE (0x6217), EVENT_REQ_313C (0x63A0). The scan
 *           counter 0x63A1 and the record's +0x18 field stay hex — unnamed scratch.
 */

import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_SPRITE_ATTR,
  BOARD,
  DIFFICULTY,
  MARIO_HAMMER_ACTIVE,
  EVENT_REQ_313C,
} from "./ram.js";

const LIVE_COUNT = 0x63a1; // scratch tally of the non-empty records this scan (unnamed)
const REC_INSERT_FIELD = 0x18; // record +0x18, set to 1 alongside +0 when a free slot is inserted

export function loc_313c(m) {
  const { mem } = m;

  let count = 0;
  mem.write8(LIVE_COUNT, count); // counter := 0

  let ix = OBJ_ARRAY_64;
  for (let i = 0; i < 5; i++, ix = (ix + 0x20) & 0xffff) {
    if (mem.read8((ix + OBJ_ACTIVE) & 0xffff) !== 0) {
      // Live record: tally it and flag its +8 field (forced off while a hammer swings).
      count = (count + 1) & 0xff;
      mem.write8(LIVE_COUNT, count);
      const hammerHeld = mem.read8(MARIO_HAMMER_ACTIVE) === 0x01;
      mem.write8((ix + OBJ_SPRITE_ATTR) & 0xffff, hammerHeld ? 0x00 : 0x01);
      continue;
    }

    // Empty record. (count === 5 here is unreachable from the entry — count <= 4 at any empty
    // slot — but keep the guard so the dead arm stays faithful to the oracle's control flow.)
    if (count === 0x05) continue;

    // On 50m, once the difficulty ramp equals the running count, return normally at once —
    // WITHOUT clearing the pending request (short-circuit matches the oracle: off 50m the
    // DIFFICULTY read never happens).
    if (mem.read8(BOARD) === 0x02 && mem.read8(DIFFICULTY) === count) return true;

    // Otherwise honour a pending INSERT request (== 1) into this free slot.
    if (mem.read8(EVENT_REQ_313C) === 0x01) {
      mem.write8((ix + OBJ_ACTIVE) & 0xffff, 0x01); // activate the slot
      mem.write8((ix + REC_INSERT_FIELD) & 0xffff, 0x01);
      mem.write8(EVENT_REQ_313C, 0x00); // consume the request
      count = (count + 1) & 0xff;
      mem.write8(LIVE_COUNT, count);
    }
  }

  // Clear the INSERT request latch, then take the caller-skip only on a wholly empty array.
  mem.write8(EVENT_REQ_313C, 0x00);
  return count !== 0; // true = normal return; false = SPLICE past the caller
}
