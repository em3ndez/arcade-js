// SPDX-License-Identifier: GPL-3.0-only
// Sound-cue burst: queue five command words. The first three carry the caller's channel (D) — twice on
// the next channel — then two fixed cues on channel 7. Each word is (channel << 8) | param.
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function loc_05e2(m, channel = m.regs.d) {
  enqueueCommandWord(m, (channel << 8) | 2);
  enqueueCommandWord(m, ((channel + 1) << 8) | 2);
  enqueueCommandWord(m, ((channel + 1) << 8) | 4);
  enqueueCommandWord(m, (7 << 8) | 3);
  return enqueueCommandWord(m, 7 << 8);
}
