// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBoardObjects — service the six board objects for one pass, then publish their
 * positions to the sprite buffer.  ROM 0x2722.
 *
 * The 0x6600 array holds six 16-byte board-object records. Once per board-object
 * service pass (tail-called from ROM 0x26FA) this does three things in order:
 *
 *   1. ADVANCE — step every active object one pixel toward its limit, landing or
 *      deactivating it on arrival (advanceBoardObjectTravel).
 *   2. SPAWN — on the spawn cadence, claim a free slot and seed a new object;
 *      otherwise just tick the cadence timer (spawnBoardObject).
 *   3. PUBLISH — walk all six records and copy each object's X and Y into its own
 *      4-byte sprite record in the sprite shadow buffer, so the object renders at
 *      its current position. X lands at the record's first byte, Y at its fourth;
 *      the six records sit consecutively from SPRITE_BUFFER + 88 (sprite record 22).
 *
 * The order matters: advance and spawn are what MOVE the objects, and the publish
 * walk reads the positions they just produced — so the sprite records always show
 * this pass's motion.
 *
 * NAME (promoted, DK understanding pass 7 — independent proposer≠confirmer): the
 * board-object service loop. The name describes the STRUCTURAL service pass (advance +
 * spawn + mirror positions to sprites) — oracle-pinned over the rated OBJ_ARRAY_66 /
 * OBJ_X / OBJ_Y / SPRITE_BUFFER cells, using the blessed "board object" vocabulary
 * already carried by spawnBoardObject and the advanceBoardObjectTravel header — and makes no claim about
 * what the objects ARE in gameplay (that identity stays ungrounded, so the animate callee
 * stays advanceBoardObjectTravel and the spawn seed bytes stay ungrounded in spawnBoardObject).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2722.test.js.
 * GATE:     crafted. 0x2722 is board-gated and never dispatches in 25m attract
 *           (0 dispatches over 2000 frames), so there are no natural entries to
 *           capture; validated by crafted entries on a real attract base that poke
 *           the six object records and the spawn timer identically on both sides to
 *           drive every arm the callees can take (rising/landing, falling/deactivate,
 *           inactive, off-beat tick, spawn into a free slot, all-slots-busy) and then
 *           check the published sprite records. Teeth: wrong publish stride, swapped
 *           X/Y source fields, a short count, and publishing BEFORE advancing.
 * LIVE-OUT: memory-only — the six object records (written by the callees) and the six
 *           published sprite records in SPRITE_BUFFER. The caller tail-calls this and
 *           reloads its own registers, so the residual registers/flags are dead. The
 *           oracle brackets its two callee calls with a stack push each and returns
 *           with a terminal pop; the idiomatic form direct-calls both, so the dead
 *           STACK_SCRATCH the pushes leave is excluded from the RAM diff.
 * NAMES:    OBJ_ARRAY_66 (0x6600), OBJ_X (+3), OBJ_Y (+5), SPRITE_BUFFER (0x6900) from
 *           names.js; advanceBoardObjectTravel (ROM 0x2797) and spawnBoardObject (ROM 0x27DA) direct-called.
 *           The six-record publish destination (SPRITE_BUFFER + 88) has no names.js name of
 *           its own.
 */

import { OBJ_ARRAY_66, OBJ_X, OBJ_Y, SPRITE_BUFFER } from "./names.js";
import { advanceBoardObjectTravel } from "./advanceBoardObjectTravel.js";               // ROM 0x2797 — advance the objects
import { spawnBoardObject } from "./spawnBoardObject.js"; // ROM 0x27DA — spawn on cadence

const RECORD_COUNT = 6;      // six board objects
const OBJ_STRIDE = 16;       // stride between object records in OBJ_ARRAY_66
const SPRITE_STRIDE = 4;     // stride between sprite records in SPRITE_BUFFER
const PUBLISH_BASE = SPRITE_BUFFER + 88; // the objects' sprite records: record 22 onward
const SPRITE_Y = 3;          // Y byte offset within a 4-byte sprite record (X is byte 0)

/**
 * @param {object} m  the machine (uses m.mem; direct-calls the two service callees).
 * @returns {void}
 */
export function serviceBoardObjects(m) {
  const { mem } = m;

  // Advance the existing objects, then try to spawn a new one. (The oracle hands the
  // record stride from the animate walk to the spawn walk in a register; the idiomatic
  // spawn carries its own stride, so that hand-off is dead here.)
  advanceBoardObjectTravel(m);
  spawnBoardObject(m);

  // Publish: mirror each object's current X and Y into its sprite record.
  let src = OBJ_ARRAY_66;
  let dst = PUBLISH_BASE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    mem.write8(dst, mem.read8(src + OBJ_X));
    mem.write8(dst + SPRITE_Y, mem.read8(src + OBJ_Y));
    dst += SPRITE_STRIDE;
    src += OBJ_STRIDE;
  }
}
