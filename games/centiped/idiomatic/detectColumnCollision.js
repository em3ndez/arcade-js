// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_34, loc_44, loc_54, loc_64, loc_8b, loc_8c } from "./names.js";

/**
 * detectColumnCollision -- proximity test: does any OTHER live object share object X's
 * column and sit within a short row band of it?
 *
 * ROLE IN THE MACHINE: this is the anti-overlap check threaded through the centipede's
 * per-segment walk. As each body segment (and the head) is moved a step at a time,
 * the mover asks "is a neighbour right in front of me in this same column?" so that
 * two segments do not march through one another, and so the head can steer around its
 * own trailing body. The object arrays are the classic Centipede parallel-field
 * layout: column at $64+slot (ROM 0x0064 base), fine row at $54+slot (ROM 0x0054),
 * a direction/delta key at $44+slot (ROM 0x0044), and a liveness/row byte at $34+slot
 * (ROM 0x0034). Behaviour-derived; the exact cell identities are read from motion, not
 * MAME-confirmed. [code]
 *
 * MECHANISM: it first stamps the current slot index X into the scratch pair $8b (ROM
 * 0x008b) and $8c = X+1 (ROM 0x008c) -- the loop reads $8b back to recognise "my own
 * slot". It caches X's three fields once (a 6502 zp,X read of column, row, and delta
 * key), then scans candidate slots Y from 0x0c down to 0x00. A candidate is skipped
 * unless it is in the SAME column, is still LIVE (its $34+Y row byte below 0xf4 -- the
 * 0xf4..0xff range marks a retired/inactive slot), and is not X itself. For a
 * surviving candidate it forms the wrapped row delta (X's row minus the candidate's)
 * and XORs in X's delta key so the band is measured in X's own direction of travel; a
 * folded delta of 0xf4 or above means the neighbour is within a few rows ahead -- a
 * collision. The scan stops at the first hit.
 *
 * LIVE-OUT: the processor carry flag (m.regs.fC) -- SET on the first qualifying
 * neighbour (collision), CLEAR when the scan finds none. RAM writes are limited to the
 * two scratch cells $8b/$8c.
 */
export function detectColumnCollision(m, x = m.regs.x) {
  const { mem8 } = m;
  // Publish the slot under test into the scratch pair ($8c = X+1) -- $8b doubles as the
  // "skip my own slot" marker the scan reads back below.
  mem8[loc_8b] = x;
  mem8[loc_8c] = u8(x + 1);
  // Cache object X's three fields once up front (zp,X reads), matching the ROM which
  // holds them in registers across the scan rather than re-indexing each pass.
  const columnX = mem8[(loc_64 + x) & 0xff]; // zp,X read of object X's column
  const rowFineX = mem8[(loc_54 + x) & 0xff];
  const deltaKeyX = mem8[(loc_44 + x) & 0xff];
  let found = false;
  // Walk every candidate slot 0x0c..0x00 looking for a blocker in the same column.
  for (let y = 0x0c; y >= 0; y--) {
    if (mem8[loc_64 + y] !== columnX) continue; // different column -> skip
    if (mem8[loc_34 + y] >= 0xf4) continue; // slot Y retired/inactive -> skip
    if (y === mem8[loc_8b]) continue; // object X's own slot -> skip
    // Row gap measured in X's travel direction: subtract rows, XOR the delta key so
    // "ahead of me" folds into the high band. >= 0xf4 == a neighbour a few rows ahead.
    const rowDelta = u8(rowFineX - mem8[loc_54 + y]) ^ deltaKeyX;
    if (rowDelta >= 0xf4) { found = true; break; } // within the row band -> collision
  }
  // Carry out reports the verdict to the mover: set = blocked, clear = clear path.
  return (m.regs.fC = found);
}
