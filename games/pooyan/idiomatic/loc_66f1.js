// SPDX-License-Identifier: GPL-3.0-only
import { loc_66fd } from "./loc_66fd.js";
import { loc_672a } from "./loc_672a.js";
import { loc_67a0 } from "./loc_67a0.js";
import { loc_67df } from "./loc_67df.js";
/**
 * loc_66f1 — dispatch the record's per-frame state handler, record based at IX.
 *
 * The record's state byte at IX+2 selects one of four handlers (0..3). Each is a tail
 * hand-off — no continuation is stacked here — so the selected handler returns straight
 * to our caller.
 *
 * LIVE-OUT: memory only — the caller's record-scan loop parks its own loop registers
 * across the call and reads no register or return value back; every effect is in memory.
 */
const STATE_OFFSET = 0x02; // record state byte, selects the handler

export function loc_66f1(m, rec = m.regs.ix) {
  const { mem8 } = m;

  switch (mem8[rec + STATE_OFFSET]) {
    case 0: return loc_66fd(m, rec);
    case 1: return loc_672a(m, rec);
    case 2: return loc_67a0(m, rec);
    case 3: return loc_67df(m, rec);
  }
}
