// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnRequestedFireAndRecolorLiveFires — sweep the five fire slots: count the live ones, recolour
 * each of them, service one pending spawn request, and splice the caller when the array is
 * empty.  ROM 0x313C.
 *
 * Walks the five OBJ_ARRAY_64 records (stride 0x20 from 0x6400) and tallies the non-empty
 * ones into OBJ_LIVE_COUNT (0x63A1). For each LIVE record it flags the record's OBJ_SPRITE_ATTR
 * field on (0x01), or off (0x00) while Mario is swinging a hammer. For each EMPTY record it may
 * honour a pending object-INSERT request (EVENT_REQ_313C, 0x63A0): off 50m, or on 50m once the
 * difficulty ramp no longer equals the running count, a raised request (== 1) activates that
 * free slot (OBJ_ACTIVE and OBJ_INSERT_REQUESTED := 1), consumes the request, and bumps the
 * count. On 50m the routine returns early — normally — the instant DIFFICULTY equals the
 * running count (and, on that early exit, the request is deliberately NOT cleared).
 *
 * THE 50m EARLY EXIT IS AN EXACT EQUALITY, NOT A POPULATION CAP. It is tested only at EMPTY
 * records, and the count is bumped at live ones, so the count can step straight PAST
 * DIFFICULTY without the test ever seeing the boundary: with DIFFICULTY 2 and the records
 * live / live / live / empty, the count is 3 when the first empty slot is reached and the
 * insert is allowed. "It stops inserting once the live count reaches DIFFICULTY" is a
 * misreading of this arm; the exit fires only on the exact hit.
 *
 * After the scan it clears the INSERT request and inspects the count: a non-zero count returns
 * normally, but a ZERO count (no live objects, no insert) takes the caller-skip SPLICE. In the
 * raw Z80 the splice discards its caller's return address (inc sp ×2 / ret) and returns a level
 * up, skipping the rest of the object pass its caller loc_30ed runs. The idiomatic form drops the
 * stack manipulation (the Z80 stack is the JS call stack) and returns the decision as a boolean
 * the caller consumes as `if (!spawnRequestedFireAndRecolorLiveFires(m)) return;` — true = normal return, false = caller spliced.
 *
 * Self-contained: reads/writes only work RAM, calls nothing.
 *
 * NAME — WHY "FIRE". OBJ_ARRAY_64 (0x6400) was grounded as the FIRES on the real ROM under
 * MAME 0.288, on a NATURAL zero-poke 25m run (scratchpad/grounding-object-arrays.md): zeroing
 * the five records' +0 erases the fireball from the screen completely (0 of 40 sampled frames)
 * while the barrels are statistically untouched, the tight A/B's first differing frame is a
 * single blob at this array's logged record position to the pixel, and boxes drawn at the
 * logged positions land on a fireball and nothing else on all four boards. HONEST FLOOR: the
 * X-pin POSITIVE control on this array is a NO-OP — the ROM recomputes +3 each frame — so the
 * identity rests on the kill control plus positional correlation, not on a coordinate command.
 * The name also says SPAWN because this routine's activation write is what makes one of these
 * objects exist: nothing else in the ROM sets a 0x6400 record's OBJ_ACTIVE from empty.
 *
 * Memory-equivalent to the frozen oracle — equivalence-313c.test.js.
 * GATE:     crafted-entry — the input space (5 slot flags × BOARD × DIFFICULTY × request ×
 *           hammer) is too large to sweep whole, so entries are crafted to cover every branch
 *           and arm (both early-normal-return paths, the INSERT arm, the hammer-off arm, and
 *           BOTH the counter!=0 normal return and the counter==0 SPLICE), backed by a structured
 *           cross-product sweep; that crafted set + sweep is the equivalence proof.
 *           REACHABILITY IS GROUNDED — observed live in MAME 0.288 on the real dkong ROM
 *           (understanding pass 12): spawnRequestedFireAndRecolorLiveFires is a live per-frame gameplay routine on every
 *           board, not dead code. In PURE ATTRACT with zero pokes and no coin, its caller
 *           0x30ED executed 1220× and spawnRequestedFireAndRecolorLiveFires 610× over 4243 frames (6329× / 3189× over a
 *           14546-frame attract run), and it ran 1069 / 3214 / 2417 / 2291× in the credited 1P
 *           / 50m / 75m / 100m runs. Every arm fires naturally: the live-record arm's store
 *           (0x315A) wrote OBJ_SPRITE_ATTR := 1 2477×; the HAMMER arm's store (0x3167) wrote
 *           OBJ_SPRITE_ATTR := 0 768×, every one of them with MARIO_HAMMER_ACTIVE == 1 during a
 *           hammer grab the attract demo performs unaided; the INSERT arm (0x319D) fetched
 *           2-13× per run and left OBJ_INSERT_REQUESTED at 1 for 310 / 186 / 70 frames; and the
 *           zero-count SPLICE (0x3179) fetched 126-707× per run. The one arm nothing drives is
 *           the counter==5 empty-slot arm: it is UNREACHABLE from the entry (the count resets
 *           to 0 and rises at most once across the five records, so it is <= 4 at any empty
 *           slot), leaving it dead on both sides. That is a STRUCTURAL argument, not an
 *           observation — its branch target 0x316A is shared with the normal loop tail, so no
 *           fetch tap can separate it — but every observed OBJ_LIVE_COUNT write sequence is
 *           consistent with it: always a contiguous run from 0, with 5 reached only in the run
 *           where all five records were live.
 * LIVE-OUT: memory-only + the boolean skip decision. Writes OBJ_LIVE_COUNT, EVENT_REQ_313C, and
 *           the per-record OBJ_ACTIVE / OBJ_SPRITE_ATTR / OBJ_INSERT_REQUESTED fields; the
 *           residual registers/flags and the Z80's two-level return are the dead skip mechanism,
 *           replaced by the boolean the caller reloads past.
 * NAMES:    OBJ_ARRAY_64 (0x6400), OBJ_ACTIVE (+0), OBJ_SPRITE_ATTR (+8), BOARD (0x6227),
 *           DIFFICULTY (0x6380), MARIO_HAMMER_ACTIVE (0x6217), EVENT_REQ_313C (0x63A0),
 *           OBJ_LIVE_COUNT (0x63A1) — the per-scan live-record tally, whose sole writer in the
 *           entire ROM is this routine — and the record field OBJ_INSERT_REQUESTED (+0x18), all
 *           imported from ram.js.
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
} from "./ram.js";

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

    // Empty record. (count === 5 here is unreachable from the entry — structurally count <= 4
    // at any empty slot; not separately observable in MAME, see the GATE note — but keep the
    // guard so the dead arm stays faithful to the oracle's control flow.)
    if (count === 0x05) continue;

    // On 50m, once the difficulty ramp equals the running count, return normally at once —
    // WITHOUT clearing the pending request (short-circuit matches the oracle: off 50m the
    // DIFFICULTY read never happens).
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
