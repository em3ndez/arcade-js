// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_572b } from "./loc_572b.js";

/**
 * loc_588e — initialise a run of sprite blocks.
 *
 * Walks `count` blocks from `base`, stepping one block each pass, and initialises each one with a
 * fixed field-seed. The per-block initialiser signals back: a live block keeps the walk going, and
 * once it seeds a fresh block it reports a stop, so this loop abandons the rest of the run (one
 * seed per entry).
 *
 * LIVE-OUT: memory only — nothing reads a register back.
 */

const BLOCK_STRIDE = 0x18; // bytes between consecutive sprite blocks
const INIT_SEED = 0x04; // field seed handed to each block initialiser

export function loc_588e(m, base = m.regs.ix, count = m.regs.b, col = m.regs.c) {
  let cursor = base;
  let remaining = count;
  do {
    if (loc_572b(m, cursor, col, INIT_SEED)) return; // seeded a fresh block -> stop the run
    cursor = u16(cursor + BLOCK_STRIDE);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}
