// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { loc_5489 } from "./loc_5489.js";
import { SPAWN_SEQUENCE_INDEX_8D13, SPAWN_KIND_TABLE_5647 } from "./names.js";
/**
 * seedFirstFreeSlotForScheduledSpawn — scan an actor-block table and seed the first free slot (spawn scheduler B tail).
 *
 * Walks `count` stride-`stride` blocks from `base`. A block is live while (blk+0)|(blk+1) != 0; those
 * are skipped. At the first free block it seeds the kind byte from SPAWN_KIND_TABLE_5647, indexed by
 * the low nibble of the advanced spawn cursor, then hands the record to the init helper to finish init.
 * Exactly one block is seeded per call; if none is free the scan falls out and returns.
 *
 * SEATING: BALANCED (net SP 0) — WIRE. The free-block exit is the init helper's caller-skip (pop af;
 * ret), which balances this routine's own frame, so the seam supplies the single ret either way.
 * DISSOLVED: the RST table fetch and the init helper (which always skips -> returns false, so the
 * caller early-returns, modelling the skip). LIVE-OUT: none (memory only) — the init helper does the
 * work and returns to this routine's caller in the common path, and it declares no register live-out.
 */

const KIND_FIELD = 0x17; //       kind/script byte the init helper reads for its anim/speed lookup
const KIND_INDEX_MASK = 0x0f; //  low nibble of the spawn cursor indexes the kind table
const SPAWN_FIELD_VALUE = 0x0f; // seeds the init helper's spawn-type field for this spawner

export function seedFirstFreeSlotForScheduledSpawn(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  let cursor = base;
  for (let i = 0; i < count; i++) {
    const live = (mem8[cursor] | mem8[u16(cursor + 1)]) !== 0;
    if (!live) {
      const idx = mem8[SPAWN_SEQUENCE_INDEX_8D13] & KIND_INDEX_MASK;
      const [kindByte] = fetchByteFromTableIndex(m, SPAWN_KIND_TABLE_5647, idx);
      mem8[u16(cursor + KIND_FIELD)] = kindByte;
      if (!loc_5489(m, cursor, SPAWN_FIELD_VALUE)) return; // always skips -> propagate the skip
    }
    cursor = u16(cursor + stride);
  }
}
