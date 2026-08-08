// SPDX-License-Identifier: GPL-3.0-only
/**
 * drainBothDeferredCellLists — one pass of the deferred cell machinery: blank what the last pass painted, paint what is
 * pending now, then COPY the pending list wholesale onto the erase list. Not a swap and not a double buffer: the copy runs
 * one way on every pass, and the two lists hold different jobs rather than alternating ones.
 * That copy is a straight byte copy of the pending list onto the erase list, as many bytes as the
 * pending cursor says are in use, cursor byte included — so it lands the pending count on top of
 * the erase cursor, and the line after replaces that with the same count plus a mark in the top
 * bit. The pending cursor is then parked on its own first entry. Where nothing was pending both
 * cursors are parked instead and no copy happens. A cursor of ZERO is not nothing pending: the
 * count is a block-copy length, and a length of zero means the whole address space.
 * LIVE-OUT: memory.
 */

import { u8, u16 } from "../../../core/int.js";
import { blankCellsPaintedLastPass } from "./blankCellsPaintedLastPass.js";
import { emptyBothDeferredCellLists } from "./emptyBothDeferredCellLists.js";
import { paintDeferredCells } from "./paintDeferredCells.js";
import { DEFERRED_BLANK_CURSOR, DEFERRED_WRITE_CURSOR } from "./names.js";

const FIRST_ENTRY = 4;
const COPIED_MARK = 0x80;
const WHOLE_ADDRESS_SPACE = 0x10000;

export function drainBothDeferredCellLists(m) {
  const { mem8, mem16 } = m;
  blankCellsPaintedLastPass(m);
  paintDeferredCells(m);

  const filled = mem8[DEFERRED_WRITE_CURSOR];
  if (filled === FIRST_ENTRY) {
    emptyBothDeferredCellLists(m);
    return;
  }

  const bytes = filled === 0 ? WHOLE_ADDRESS_SPACE : filled;
  for (let i = 0; i < bytes; i++) {
    mem8[u16(DEFERRED_BLANK_CURSOR + i)] = mem8[u16(DEFERRED_WRITE_CURSOR + i)];
  }

  mem8[DEFERRED_BLANK_CURSOR] = u8(filled + COPIED_MARK);
  mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
}
