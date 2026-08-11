// SPDX-License-Identifier: GPL-3.0-only
/** destroySlotsAndPlayerOnContact — run the player against a run of slots and, for each one that
 * overlaps, mark BOTH as hit and post the score for it. The sweep does not stop at the first,
 * and the player's own mark is re-stamped each time, so one pass can take several slots. It is refused outright unless the
 * player is still whole, and a slot is skipped unless it is whole too. Overlap is two windows on
 * two axes: the caller supplies the bias and the width for one, the other is fixed at eight either
 * side. A run of zero slots means a full two hundred and fifty-six. Its two threaded cursors are
 * handed back one past the last slot (record steps its low half only, entry whole) for a caller that
 * tail-runs another sweep on the same thread; on the early refusal neither moves.
 * LIVE-OUT: memory, plus the two cursors. */

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

export function destroySlotsAndPlayerOnContact(
  m,
  records = m.regs.de,
  entries = m.regs.iy,
  slots = m.regs.b,
  bias = m.regs.l,
  width = m.regs.h,
) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== WHOLE) return;

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
    record = (record & 0xff00) | u8(record + RECORD_STRIDE);
    entry = u16(entry + ENTRY_STRIDE);
    left = u8(left - 1);
  } while (left !== 0);

  // Hand the threaded cursors back (E only, D untouched; IY whole) for a caller tail-running the same thread.
  m.regs.e = record;
  m.regs.iy = entry;
}
