// SPDX-License-Identifier: GPL-3.0-only
/** sendOneQueuedSoundThenUnwindTheFrameInterrupt — hand the machine back to the code the vertical-blank service interrupted.
 * One waiting sound byte goes out first, so a byte queued anywhere in the service leaves on the same
 * frame. Then the register file comes back off the stack in the order it was laid down: the two index
 * registers, the whole bank the service ran in, and — once the banks are swapped back — the bank the
 * interrupted code used. Between the two banks the interrupt gate is reopened from a byte of the program
 * image rather than a literal; the accumulator that byte rides through is thrown away by the very next
 * value off the stack, so opening the gate costs the caller nothing. The pushed return address comes off
 * last and is where control resumes — the one entry that unwinds more than it was given. LIVE-OUT: every register in both banks, the interrupt gate, and what the send leaves latched. */

import { sendOldestQueuedSoundCommand } from "./sendOldestQueuedSoundCommand.js";
import { NMI_ENABLE_LATCH, NMI_REENABLE_BYTE } from "./names.js";

export function sendOneQueuedSoundThenUnwindTheFrameInterrupt(m) {
  const { regs, mem8 } = m;
  sendOldestQueuedSoundCommand(m);

  // The interrupt frame comes off the stack in the order it was laid down. The first six words
  // land in the bank the service ran in; a bank swap then puts them in the shadow set, and the
  // next three plus the final AF restore the bank the interrupted code used. iy/ix bracket both.
  const iy = m.pop16();
  const ix = m.pop16();
  const shadowHl = m.pop16();
  const shadowDe = m.pop16();
  const shadowBc = m.pop16();
  const shadowAf = m.pop16();
  const mainHl = m.pop16();
  const mainDe = m.pop16();
  const mainBc = m.pop16();
  const mainAf = m.pop16();

  // Reopen the interrupt gate from a program-image byte (0x01); the AF this rides through is the
  // next value off the stack, so the LS259 enable bit is set at no cost to the restored registers.
  mem8[NMI_ENABLE_LATCH] = mem8[NMI_REENABLE_BYTE];

  // Restore every register of both banks and return through the pushed resume address. The first
  // four popped pairs seat the shadow set directly, byte by byte; the last four seat the main set
  // the interrupted code was running in.
  return (regs.iy = iy, regs.ix = ix, regs.h_ = shadowHl >> 8, regs.l_ = shadowHl & 0xff, regs.d_ = shadowDe >> 8, regs.e_ = shadowDe & 0xff, regs.b_ = shadowBc >> 8, regs.c_ = shadowBc & 0xff, regs.a_ = shadowAf >> 8, regs.f_ = shadowAf & 0xff, regs.hl = mainHl, regs.de = mainDe, regs.bc = mainBc, regs.af = mainAf, m.ret());
}
