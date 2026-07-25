// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_309f  (ROM 0x309F–0x30BC) — enqueue a task.
 *
 *   309f  e5           push hl
 *   30a0  21 c0 60     ld   hl,0x60c0
 *   30a3  3a b0 60     ld   a,(0x60b0)
 *   30a6  6f           ld   l,a
 *   30a7  cb 7e        bit  7,(hl)
 *   30a9  ca bb 30     jp   z,0x30bb
 *   30ac  72           ld   (hl),d
 *   30ad  2c           inc  l
 *   30ae  73           ld   (hl),e
 *   30af  2c           inc  l
 *   30b0  7d           ld   a,l
 *   30b1  fe c0        cp   0xc0
 *   30b3  d2 b8 30     jp   nc,0x30b8
 *   30b6  3e c0        ld   a,0xc0
 *   30b8  32 b0 60     ld   (0x60b0),a
 *   30bb  e1           pop  hl
 *   30bc  c9           ret
 *
 * The task ring lives in page 0x60 with the write pointer at 0x60B0. A slot
 * is free when its bit 7 is SET -- which is why boot fills 0x60C0-0x60FF with
 * 0xFF: 0xFF is the empty marker, not zero. If the slot is occupied the
 * enqueue is silently dropped (`jp z,0x30bb` straight to the pop).
 *
 * L wraps back to 0xC0 rather than 0x00, so the ring is 0x60C0-0x60FF. Note
 * `inc l` is 8-bit: H stays 0x60 throughout.
 */
export function sub_309f(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x30a0, 11);
  regs.hl = 0x60c0;
  m.step(0x30a3, 10);
  regs.a = mem.read8(0x60b0);
  m.step(0x30a6, 13);
  regs.l = regs.a;
  m.step(0x30a7, 4);

  const free = regs.bit(7, mem.read8(regs.hl));
  m.step(0x30a9, 12); // bit 7,(hl)
  if (!free) {
    m.step(0x30bb, 10); // jp z -- slot occupied, drop the task
    regs.hl = m.pop16();
    m.step(0x30bc, 10);
    m.ret();
    return;
  }
  m.step(0x30ac, 10);

  mem.write8(regs.hl, regs.d);
  m.step(0x30ad, 7);
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x30ae, 4);
  mem.write8(regs.hl, regs.e);
  m.step(0x30af, 7);
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x30b0, 4);
  regs.a = regs.l;
  m.step(0x30b1, 4);
  regs.cp(0xc0);
  m.step(0x30b3, 7);
  if (regs.fC) {
    m.step(0x30b6, 10); // jp nc not taken -- wrapped below 0xC0
    regs.a = 0xc0;
    m.step(0x30b8, 7);
  } else {
    m.step(0x30b8, 10);
  }
  mem.write8(0x60b0, regs.a);
  m.step(0x30bb, 13);
  regs.hl = m.pop16();
  m.step(0x30bc, 10);
  m.ret();
}
