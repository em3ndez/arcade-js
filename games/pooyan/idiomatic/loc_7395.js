// SPDX-License-Identifier: GPL-3.0-only
import { loc_4006 } from "./loc_4006.js";
/**
 * loc_7395 — eagle dive/climb state: advance the record's animation, then integrate its 16-bit
 * vertical position by the per-record speed. An even-indexed record (bit 3 of its low address byte
 * clear) descends — add the speed, a carry bumps the row, and the bottom limit advances the state
 * byte; an odd-indexed record climbs — subtract, a borrow drops the row, and the top limit advances
 * the state byte.
 *
 * LIVE-OUT: memory only — the record's position, row and state fields.
 */

const BOTTOM_ROW = 0x1d; // descending record advances state at/after this row
const TOP_ROW = 0x04; // climbing record advances state below this row

export function loc_7395(m, rec = m.regs.ix) {
  const { mem8 } = m;
  loc_4006(m, rec);

  const climbing = (rec & 0x08) !== 0;
  if (climbing) {
    const pos = mem8[rec + 0x03] - mem8[rec + 0x09];
    mem8[rec + 0x03] = pos;
    if (pos < 0) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // borrow lifts the row
    if (mem8[rec + 0x04] >= TOP_ROW) return; // still below the top
    mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
    return;
  }

  const pos = mem8[rec + 0x03] + mem8[rec + 0x09];
  mem8[rec + 0x03] = pos;
  if (pos > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // carry drops the row
  if (mem8[rec + 0x04] < BOTTOM_ROW) return; // still above the bottom
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
