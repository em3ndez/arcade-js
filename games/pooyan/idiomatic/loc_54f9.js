// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_5489 } from "./loc_5489.js";
import { ACTOR_SPAWN_TYPE_TABLE, SPAWN_TYPE_CURSOR } from "./names.js";

/**
 * loc_54f9 — spawn-slot scan: seed one actor into the first free block.
 *
 * Walks `count` blocks from `base`, stepping `stride` each pass. A block whose first two bytes are
 * both zero is free: its kind byte is picked from the spawn-type table (indexed by the low nibble
 * of the schedule cursor) and stored into the block's kind field, then the block is seeded and the
 * scan stops — one spawn per entry. A block with either byte set is live, so the walk continues;
 * if no free block is found the routine just returns.
 *
 * LIVE-OUT: memory only — nothing reads a register back.
 */

const SEED_COUNT = 0x0b; // stamped into the seeded block's count field
const KIND_FIELD = 0x17; // block offset holding the spawn kind byte

export function loc_54f9(m, base = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  let cursor = base;
  let remaining = count;
  do {
    if ((mem8[cursor] | mem8[u16(cursor + 1)]) === 0) {
      const kind = loc_0020(m, ACTOR_SPAWN_TYPE_TABLE, mem8[SPAWN_TYPE_CURSOR] & 0x0f)[0];
      mem8[u16(cursor + KIND_FIELD)] = kind;
      loc_5489(m, cursor, SEED_COUNT); // seed the free block; returns to our caller
      return;
    }
    cursor = u16(cursor + stride);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}
