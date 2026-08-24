// SPDX-License-Identifier: GPL-3.0-only
import { loc_2c58 } from "./loc_2c58.js";
import { loc_2cb3 } from "./loc_2cb3.js";
import { loc_2d24 } from "./loc_2d24.js";
import { loc_2d4a } from "./loc_2d4a.js";
/**
 * loc_2c3f — per-hunter-record state dispatcher (boolean caller-skip). Returns true (keep walking) for
 * an inactive slot (bit0 of (IX+0)|(IX+1) clear) or a state below the dispatch range; otherwise
 * ((IX+2)&0x1f)-0x11 selects one of four handlers and their boolean is propagated (the state-0 handler
 * is itself a caller-skip). LIVE-OUT: the boolean; every other effect is memory.
 */
export function loc_2c3f(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return true; // inactive slot
  const state = mem8[rec + 0x02] & 0x1f;
  if (state < 0x11) return true; // state below the dispatch range
  switch (state - 0x11) {
    case 0: return loc_2c58(m, rec);
    case 1: return loc_2cb3(m, rec);
    case 2: return loc_2d24(m, rec);
    case 3: return loc_2d4a(m, rec);
    default:
      throw new Error("loc_2c3f: hunter state index > 3 (guard-slack; the table has 4 entries)");
  }
}
