// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  FORMATION_SLOT_TABLE,
  DISPLAY_LIST_DST_PTR,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_SRC_PTR_ALT,
  SUBPHASE_TICK,
} from "./names.js";
/**
 * Display-list interpreter. It chooses a destination/source pointer pair -- a primary pair, or
 * an alternate one when the sub-phase selector is nonzero -- then walks up to a fixed number of
 * source bytes. A plain byte is copied to the destination; a skip opcode advances the
 * destination by the following byte and shrinks the remaining count; a reload opcode loads a
 * fresh destination pointer from the stream and folds the next byte into the sub-phase tick. On
 * exit the advanced pointers are written back to whichever pair was chosen on entry.
 *
 * LIVE-OUT: memory only -- the copied cells, the written-back pointer pair, and the tick.
 */

const MAX_BYTES = 0x1d; // ceiling on bytes processed per call
const CMD_SKIP = 0x10; // advance the destination, shrink the remaining count
const CMD_RELOAD = 0xff; // reload the destination pointer + bump the tick

export function loc_4381(m) {
  const { mem8 } = m;

  const useAlt = mem8[FORMATION_SLOT_TABLE] !== 0;
  const dstPtr = useAlt ? DISPLAY_LIST_DST_PTR_ALT : DISPLAY_LIST_DST_PTR;
  const srcPtr = useAlt ? DISPLAY_LIST_SRC_PTR_ALT : DISPLAY_LIST_SRC_PTR;

  let dst = mem8[dstPtr] | (mem8[dstPtr + 1] << 8);
  let src = mem8[srcPtr] | (mem8[srcPtr + 1] << 8);
  let remaining = MAX_BYTES;
  let advanceDstThree = true; // the tail step, skipped only by a reload opcode

  while (remaining > 0) {
    const cmd = mem8[src];
    if (cmd === CMD_SKIP) {
      const skip = mem8[u16(src + 1)];
      dst = u16(dst + skip);
      src = u16(src + 2);
      remaining = (remaining - skip) & 0xff;
      if (remaining === 0) break;
      continue;
    }
    if (cmd === CMD_RELOAD) {
      dst = mem8[u16(src + 1)] | (mem8[u16(src + 2)] << 8);
      mem8[SUBPHASE_TICK] = mem8[SUBPHASE_TICK] + mem8[u16(src + 3)];
      src = u16(src + 4);
      advanceDstThree = false;
      break;
    }
    mem8[dst] = cmd;
    src = u16(src + 1);
    dst = u16(dst + 1);
    remaining -= 1;
  }

  if (advanceDstThree) dst = u16(dst + 3);

  mem8[dstPtr] = dst;
  mem8[dstPtr + 1] = dst >> 8;
  mem8[srcPtr] = src;
  mem8[srcPtr + 1] = src >> 8;
}
