// SPDX-License-Identifier: GPL-3.0-only
/** destroySlotsAndPlayerOnContact — run the player against a run of slots and, for each one that
 * overlaps, mark BOTH as hit and post the score for it. The sweep does not stop at the first,
 * and the player's own mark is re-stamped each time, so one pass can take several slots. It is refused outright unless the
 * player is still whole, and a slot is skipped unless it is whole too. Overlap is two windows on
 * two axes: the caller supplies the bias and the width for one, the other is fixed at eight either
 * side. A run of zero slots means a full two hundred and fifty-six. Its two threaded cursors are
 * handed back one past the last slot (record steps its low half only, entry whole) for a caller that
 * tail-runs another sweep on the same thread; on the early refusal neither moves.
 * LIVE-OUT: memory, plus the two cursors (record in E, entry in IY).
 *
 * THREADING RETURN (added for C2 de-register work): also returns the cursor pair as a tuple
 * { record, entry } so a tail-running caller can thread it without reading regs.e/regs.iy back. The
 * register writes are unchanged and remain the declared behaviour; on the early refusal neither
 * register is written and the tuple echoes the un-advanced input cursors. Fields are u16-wrapped. */

import { u8, u16 } from "../../../core/int.js";
import { postChainedHitScore } from "./postChainedHitScore.js";
import { PLAYER_ENTRY, PLAYER_SPRITE_Y, PLAYER_STATE } from "./names.js";


const WHOLE = 0xff;
const HIT = 0xf0;

const FIRST_COORDINATE = 0x00;
const SECOND_COORDINATE = 0x31;
const SECOND_BIAS = 8;
const SECOND_WIDTH = 17;

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function destroySlotsAndPlayerOnContact(m, records = m.regs.de, entries = m.regs.iy, slots = m.regs.b, bias = m.regs.l, width = m.regs.h) {
  const { mem8 } = m;
  // Early refusal: neither cursor moves (declared behaviour); the tuple echoes the seated inputs.
  if (mem8[PLAYER_STATE] !== WHOLE) return { record: u16(records), entry: u16(entries) };

  let record = records;
  let entry = entries;
  let left = slots;
  do {
    const acrossFirst = u8(mem8[PLAYER_ENTRY] - mem8[u16(entry + FIRST_COORDINATE)]);
    const acrossSecond = u8(mem8[PLAYER_SPRITE_Y] - mem8[u16(entry + SECOND_COORDINATE)]);
    if (
      mem8[record] === WHOLE &&
      u8(acrossFirst + bias) < width &&
      u8(acrossSecond + SECOND_BIAS) < SECOND_WIDTH
    ) {
      mem8[PLAYER_STATE] = HIT;
      mem8[record] = HIT;
      postChainedHitScore(m);
    }
    record = (record - (record & 0xff)) | u8(record + RECORD_STRIDE);
    entry = u16(entry + ENTRY_STRIDE);
    left = u8(left - 1);
  } while (left !== 0);

  // Hand the threaded cursors back (E only, D untouched; IY whole) folded into the return, keeping the
  // declared live-out writes without a bare register statement (assignment yields its RHS pre-mask).
  return { record: u16(m.regs.e = record), entry: u16(m.regs.iy = entry) };
}
