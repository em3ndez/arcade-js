// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2527 } from "./loc_2527.js";
import { BOARD_CLEAR_FLAG, TAMPER_STRIKES_TERMINATOR } from "./names.js";
/**
 * loc_2514 — copy a run of display tiles into successive actor records, then maybe reset the board.
 *
 * For each of `count` records it copies one source byte into that record's tile field, stepping the
 * source pointer up by one and the record pointer on by `stride`. When the run is done it ORs the
 * terminator strike counter with the board-clear flag; if either is set it hands off to the board and
 * HUD reset, otherwise it just returns.
 *
 * LIVE-OUT: IX = the record pointer advanced past the run (start + count*stride) and B = 0 (the
 * drained counter). On the plain-return path HL = the board-clear flag address and A = the OR result
 * (which is 0 there); on the reset path A/HL/B are whatever the reset leaves. All bridged for the
 * frozen dispatch callers.
 */

const RECORD_TILE_FIELD = 0x0f; // record byte the source tile is written into

export function loc_2514(m, src = m.regs.hl, count = m.regs.b, stride = m.regs.de, ix = m.regs.ix, cmdLow = m.regs.e) {
  const { mem8 } = m;

  let source = src;
  let record = ix;
  let remaining = count;
  do {
    mem8[record + RECORD_TILE_FIELD] = mem8[source];
    source = u16(source + 1);
    record = u16(record + stride);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  const divert = mem8[TAMPER_STRIKES_TERMINATOR] | mem8[BOARD_CLEAR_FLAG];
  if (divert !== 0) {
    const fill = loc_2527(m, cmdLow); // sets A/HL/B for the reset; leaves IX alone
    return [(m.regs.ix = record), fill];
  }
  return [(m.regs.ix = record), (m.regs.hl = BOARD_CLEAR_FLAG), (m.regs.b = 0), (m.regs.a = divert)];
}
