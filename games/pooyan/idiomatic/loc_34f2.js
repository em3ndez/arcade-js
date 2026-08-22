// SPDX-License-Identifier: GPL-3.0-only
import { loc_34b0 } from "./loc_34b0.js";
import { loc_3473 } from "./loc_3473.js";
import { TURN_COLUMN_LIMIT, PLAY_STATE_INDEX } from "./names.js";
/**
 * loc_34f2 — advance an object's sub-position toward its target, then branch on the masked column.
 *
 * Adds the record's signed step (field 0x0a) to the sub-position (field 0x05), borrowing down into
 * the column byte (field 0x06) when the sub-position is below the negated step. It then masks the
 * column to five bits and compares it against the shared turn-column limit: below the limit it tails
 * into the shared movement handler at column zero else, only in play sub-state four, disarms the
 * record (field 0x08); equal to the limit it also tails at column zero else, again only in sub-state
 * four and once the aim field (0x09) has caught up, re-arms the interior band; above the limit returns.
 *
 * LIVE-OUT: none — the dispatch caller reloads A on return and reads no other register back.
 */
const COLUMN_MASK = 0x1f;
const PLAY_STATE_FOURTH = 0x04;

export function loc_34f2(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const step = mem8[ix + 0x0a];
  const pos = mem8[ix + 0x05];
  if (pos < ((-step) & 0xff)) mem8[ix + 0x06] = mem8[ix + 0x06] - 1; // borrow into the column (byte wraps)
  const newPos = (pos + step) & 0xff;
  mem8[ix + 0x05] = newPos;

  const column = mem8[ix + 0x06] & COLUMN_MASK;
  const limit = mem8[TURN_COLUMN_LIMIT];

  if (column === limit) {
    if (column === 0) return loc_34b0(m, ix);
    if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_FOURTH) return;
    if (mem8[ix + 0x09] < newPos) return; // aim not yet caught up to the new sub-position
    return loc_3473(m, ix);
  }

  if (column > limit) return; // overshot the limit
  if (column === 0) return loc_34b0(m, ix);
  if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_FOURTH) return;
  mem8[ix + 0x08] = 0x00; // disarm the record
}
