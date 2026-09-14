// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  MODE_DISPATCH_SEL, DRAW_RECORD_PTR_LO, LEVEL_LAYOUT_TRIGGER, SCORE_DISPLAY_TIMER, loc_455,
  VEC_LIST_HEADER_LO, VEC_LIST_HEADER_HI, VECHEAD0_PLAY, VECHEAD1_PLAY, VECHEAD0_LEVEL,
} from "./names.js";
import { resetMathboxInputs } from "./resetMathboxInputs.js";
import { dispatchDisplayModeHandler } from "./dispatchDisplayModeHandler.js";
import { drawFrame } from "./drawFrame.js";
import { seatDrawCursor } from "./seatDrawCursor.js";
import { closeLayerPointer } from "./closeLayerPointer.js";
import { emitFrameLink } from "./emitFrameLink.js";

// Per-frame vector housekeeping. First clear the frame work cells. Return early when the two guard
// cells say the frame is already settled. When the mode cell is zero, hand the whole draw to the
// frame builder. Otherwise: publish the active pointer, and unless the checkpoint helper reports a
// change, run the trampoline dispatch and — when the active-slot flag is set — fold a 40-byte block
// under the pointer into a single checksum byte (a running subtract, carry-chained, decimal-aware when
// the D flag is live, then two conditional whitening steps). Finally emit the trailing header record
// and latch the two source bytes into the first display words.
//
// dFlag carries the CPU decimal flag in from the bridge: an earlier stage may leave it set, and the
// subtract below must BCD-correct its accumulator to match the hardware when it is.
export function buildFrameVectors(m, dFlag = m.regs.fD) {
  const { mem8, mem16 } = m;

  resetMathboxInputs(m);

  // Frame already settled: guard cell matches its checkpoint and the pending flag is clear.
  if (mem8[VEC_LIST_HEADER_LO] === mem8[VECHEAD0_LEVEL] && mem8[LEVEL_LAYOUT_TRIGGER] === 0) return;

  // Mode zero routes the entire draw through the frame builder.
  if (mem8[MODE_DISPATCH_SEL] === 0) { drawFrame(m); return; }

  seatDrawCursor(m, 0x00);
  const changed = emitFrameLink(m); // true = a change was published; skip the checksum path
  if (!changed) {
    dispatchDisplayModeHandler(m); // computed-jump dispatch
    if (mem8[SCORE_DISPLAY_TIMER] !== 0) {
      const ptr = mem16[DRAW_RECORD_PTR_LO];
      let a = 0x0e;
      let carry = 1; // seeded set
      for (let y = 0x27; y >= 0; y--) {
        const v = mem8[u16(ptr + y)];
        const c = carry ? 1 : 0;
        const diff = a - v - (1 - c);
        carry = diff >= 0 ? 1 : 0; // borrow flag is the binary result in both modes
        if (dFlag) {
          let al = (a & 0x0f) - (v & 0x0f) - (1 - c);
          if (al < 0) al = ((al - 6) & 0x0f) - 0x10;
          let sum = (a & 0xf0) - (v & 0xf0) + al;
          if (sum < 0) sum -= 0x60;
          a = sum & 0xff;
        } else {
          a = diff & 0xff;
        }
      }
      let cs = a;
      if (cs !== 0) cs = (cs ^ 0xe5) & 0xff;
      if (cs !== 0) cs = (cs ^ 0x29) & 0xff;
      mem8[loc_455] = cs;
    }
  }

  closeLayerPointer(m, 0x00);
  mem8[VEC_LIST_HEADER_LO] = mem8[VECHEAD0_PLAY];
  mem8[VEC_LIST_HEADER_HI] = mem8[VECHEAD1_PLAY];
}
