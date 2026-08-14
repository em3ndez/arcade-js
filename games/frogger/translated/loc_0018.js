// SPDX-License-Identifier: GPL-3.0-only

// loc_0018  (ROM 0x0018-0x0027) — the rst 0x18 target: enqueue the byte in A into
// the sound-command ring at 0x8300 (head at 0x8300, entries above it). No-op while
// 0x83fe (the play/attract flag) is zero.
export function loc_0018(m) {
  const { regs, mem } = m;

  regs.c = regs.a;
  m.step(0x0019, 4); // ld c,a -- hold the command byte

  regs.a = mem.read8(0x83fe);
  m.step(0x001c, 13);

  regs.or(regs.a);
  m.step(0x001d, 4);

  if (regs.fZ) {
    m.ret(11); // ret z (taken) -- not playing, drop the command
    return;
  }
  m.step(0x001e, 5);

  m.push16(regs.hl);
  m.step(0x001f, 11);

  regs.hl = 0x8300;
  m.step(0x0022, 10);

  regs.incMem8(mem, regs.hl);
  m.step(0x0023, 11); // inc (hl) -- bump the ring head

  regs.a = mem.read8(regs.hl);
  m.step(0x0024, 7); // ld a,(hl) -- new head index

  regs.l = regs.a;
  m.step(0x0025, 4); // ld l,a -- HL = 0x83<head>

  mem.write8(regs.hl, regs.c);
  m.step(0x0026, 7); // ld (hl),c -- store the command at the ring slot

  regs.hl = m.pop16();
  m.step(0x0027, 10);

  m.ret();
}
