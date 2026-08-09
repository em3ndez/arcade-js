// SPDX-License-Identifier: GPL-3.0-only
/** loc_0167 — data bytes run as code on a derail arm, not a routine the game calls on purpose.
 * Executed, they bump one work-RAM cell whose low address byte the accumulator supplies, fetch a
 * table word this path never reads, drop two words off the stack, and fall into the frame-interrupt
 * epilogue that sends any queued sound, unwinds the frame, reopens the gate, and resumes.
 * LIVE-OUT: memory plus the whole register file the epilogue restores from the stack. */

import { u8 } from "../../../core/int.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt } from "./sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";

export function loc_0167(m) {
  const { regs, mem8 } = m;

  regs.l = regs.a;
  regs.and(mem8[regs.hl]);
  regs.d = regs.inc8(regs.d);
  regs.adc(regs.b);
  regs.d = regs.a;
  regs.and(regs.l);
  regs.cp(regs.a);
  mem8[regs.hl] = u8(mem8[regs.hl] + 1);

  fetchTableWord(m);

  regs.af = m.pop16();
  regs.sub(mem8[regs.hl]);
  regs.af = m.pop16();
  regs.cp(regs.c);

  return sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
}
