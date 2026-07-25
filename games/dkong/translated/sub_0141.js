// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0141  (ROM 0x0141–0x017A) — program the i8257 and kick the blit.
 *
 *   0141  af           xor  a
 *   0142  32 85 7d     ld   (0x7d85),a
 *   0145  7e           ld   a,(hl)
 *   0146  32 08 78     ld   (0x7808),a
 *   0149  23           inc  hl
 *   014a  7e           ld   a,(hl)
 *   014b  32 00 78     ld   (0x7800),a
 *   014e  23           inc  hl
 *   014f  7e           ld   a,(hl)
 *   0150  32 00 78     ld   (0x7800),a      <- SAME address again
 *   0153  23           inc  hl
 *   0154  7e           ld   a,(hl)
 *   0155  32 01 78     ld   (0x7801),a
 *   0158  23           inc  hl
 *   0159  7e           ld   a,(hl)
 *   015a  32 01 78     ld   (0x7801),a
 *   015d  23           inc  hl
 *   015e  7e           ld   a,(hl)
 *   015f  32 02 78     ld   (0x7802),a
 *   0162  23           inc  hl
 *   0163  7e           ld   a,(hl)
 *   0164  32 02 78     ld   (0x7802),a
 *   0167  23           inc  hl
 *   0168  7e           ld   a,(hl)
 *   0169  32 03 78     ld   (0x7803),a
 *   016c  23           inc  hl
 *   016d  7e           ld   a,(hl)
 *   016e  32 03 78     ld   (0x7803),a
 *   0171  3e 01        ld   a,0x01
 *   0173  32 85 7d     ld   (0x7d85),a
 *   0176  af           xor  a
 *   0177  32 85 7d     ld   (0x7d85),a
 *   017a  c9           ret
 *
 * Nine bytes are read from (HL) -- the block at ROM 0x0138-0x0140 -- and
 * written to the 8257. Note each 16-bit register is written by storing TWICE
 * to the same address: the 8257 has an internal high/low byte flip-flop, so
 * `ld (0x7800),a` twice sets the low then the high byte of channel 0's
 * address. Translating those as two different registers would be silently
 * wrong.
 *
 * The block decodes to: mode 0x53, ch0 addr 0x6900 count 0x4180,
 * ch1 addr 0x7000 count 0x8180 -- 385 transfers (the count holds n-1), which
 * covers 96 sprites x 4 bytes plus one.
 *
 * Then DRQ at 0x7D85 is pulsed 1 then 0. THE RISING EDGE IS THE BLIT: sprite
 * data reaches the screen through this, not through direct writes, so the
 * WHEN matters as much as the WHAT.
 */
export function sub_0141(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0142, 4);
  mem.write8(0x7d85, regs.a, 10); // DRQ low before programming
  m.step(0x0145, 13);

  // The nine register writes, in ROM order. Each pair to the same address
  // is low-byte-then-high-byte via the 8257's internal flip-flop.
  const WRITES = [
    [0x7808, 0x0146, 0x0149], [0x7800, 0x014b, 0x014e],
    [0x7800, 0x0150, 0x0153], [0x7801, 0x0155, 0x0158],
    [0x7801, 0x015a, 0x015d], [0x7802, 0x015f, 0x0162],
    [0x7802, 0x0164, 0x0167], [0x7803, 0x0169, 0x016c],
    [0x7803, 0x016e, null],
  ];
  for (const [port, afterStore, afterInc] of WRITES) {
    regs.a = mem.read8(regs.hl);
    m.step(afterStore - 3, 7); // ld a,(hl)
    mem.write8(port, regs.a, 10); // ld (nn),a
    m.step(afterInc === null ? 0x0171 : afterStore, 13); // ld (nn),a
    if (afterInc !== null) {
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(afterInc, 6); // inc hl
    }
  }

  regs.a = 0x01;
  m.step(0x0173, 7);
  mem.write8(0x7d85, regs.a, 10); // DRQ rising edge -- THE BLIT HAPPENS HERE
  // ORDER: the store instruction COMPLETES first, then the bus is granted.
  // MAME's Z80 checks BUSREQ in its ROP (opcode-fetch) state, so the grant
  // happens at the next INSTRUCTION boundary -- not mid-instruction. Charging
  // the stolen cycles before the instruction's own time had the CPU halted
  // partway through a store, which is not what the hardware does.
  m.step(0x0176, 13);
  m.tick(m.io.dma.cyclesStolen);
  m.io.dma.cyclesStolen = 0;
  regs.xor(regs.a);
  m.step(0x0177, 4);
  mem.write8(0x7d85, regs.a, 10);
  m.step(0x017a, 13);

  m.ret();
}
