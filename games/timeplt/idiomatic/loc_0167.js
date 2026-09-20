// SPDX-License-Identifier: GPL-3.0-only
/** loc_0167 — data bytes run as code on a derail arm, not a routine the game calls on purpose.
 * Executed, they bump one work-RAM cell whose low address byte the accumulator supplies, fetch a
 * table word this path never reads, drop two words off the stack, and fall into the frame-interrupt
 * epilogue that sends any queued sound, unwinds the frame, reopens the gate, and resumes.
 * LIVE-OUT: memory plus the whole register file the epilogue restores from the stack. */

import { u8 } from "../../../core/int.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt } from "./sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";

export function loc_0167(m, a = m.regs.a, b = m.regs.b, c = m.regs.c, d = m.regs.d) {
  const { regs, mem8 } = m;

  regs.l = a; // seeds the pointer the table fetch reads back; stays a register
  const ptr = regs.hl;
  regs.and(mem8[ptr]);
  regs.inc8(d);
  regs.adc(b);
  regs.and(a);
  regs.cp(regs.a);
  mem8[ptr] = u8(mem8[ptr] + 1);

  fetchTableWord(m);

  regs.af = m.pop16();
  regs.sub(mem8[regs.hl]);
  regs.af = m.pop16();
  regs.cp(c);

  return sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
}
