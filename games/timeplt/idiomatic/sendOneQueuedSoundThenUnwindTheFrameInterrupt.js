// SPDX-License-Identifier: GPL-3.0-only
/** sendOneQueuedSoundThenUnwindTheFrameInterrupt — hand the machine back to the code the vertical-blank service interrupted.
 *
 * One waiting sound byte goes out first, so a byte queued anywhere in the service leaves on the
 * same frame it was queued. Then the register file comes back off the stack in the order it was
 * laid down: the two index registers, the whole bank the service itself ran in, and — once the
 * banks have been swapped back — the bank the interrupted code was using. Between the two banks
 * the interrupt gate is opened again, from a byte of the program image rather than a literal; the
 * accumulator that byte travels through is thrown away by the very next value off the stack, so
 * opening the gate costs the caller nothing. The address the interrupt pushed comes off last and
 * is where control resumes, which makes this the one entry that unwinds more than it was given.
 * LIVE-OUT: every register in both banks, the interrupt gate, and what the send leaves latched. */

import { sendOldestQueuedSoundCommand } from "./sendOldestQueuedSoundCommand.js";

const INTERRUPT_GATE = 0xc300;
const GATE_OPEN_BYTE = 0x1600;
const WRITE_BUS_CYCLE = 10;

export function sendOneQueuedSoundThenUnwindTheFrameInterrupt(m) {
  const { regs, mem } = m;
  sendOldestQueuedSoundCommand(m);

  regs.iy = m.pop16();
  regs.ix = m.pop16();
  regs.hl = m.pop16();
  regs.de = m.pop16();
  regs.bc = m.pop16();
  regs.af = m.pop16();

  regs.exx();
  regs.exAf();

  regs.hl = m.pop16();
  regs.de = m.pop16();
  regs.bc = m.pop16();
  mem.write8(INTERRUPT_GATE, mem.read8(GATE_OPEN_BYTE), WRITE_BUS_CYCLE);
  regs.af = m.pop16();

  m.ret();
}
