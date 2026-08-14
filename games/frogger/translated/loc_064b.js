// SPDX-License-Identifier: GPL-3.0-only

// loc_064b  (ROM 0x064B-0x066F) — seed the attract-demo state: clear 0x800C-0x8037 to 0x00, copy
// that same 0x2B-byte block into OBJRAM 0xB00C, then clear 0x8100-0x8162 to 0x00.
export function loc_064b(m) {
  const { regs, mem } = m;

  regs.hl = 0x800c;
  m.step(0x064e, 10);

  regs.de = 0x800d;
  m.step(0x0651, 10);

  regs.bc = 0x002b;
  m.step(0x0654, 10);

  mem.write8(regs.hl, regs.b);
  m.step(0x0655, 7); // ld (hl),b -- B=0x00 seeds the propagating ldir fill

  m.ldirAt(0x0655, 0x0657); // ldir -- clear 0x800C-0x8037 to 0x00

  regs.hl = 0x800c;
  m.step(0x065a, 10);

  regs.de = 0xb00c;
  m.step(0x065d, 10);

  regs.bc = 0x002b;
  m.step(0x0660, 10);

  m.ldirAt(0x0660, 0x0662); // ldir -- copy the cleared block into OBJRAM 0xB00C

  regs.hl = 0x8100;
  m.step(0x0665, 10);

  regs.de = 0x8101;
  m.step(0x0668, 10);

  regs.bc = 0x0062;
  m.step(0x066b, 10);

  mem.write8(regs.hl, 0x00);
  m.step(0x066d, 10); // ld (hl),0x00 -- seed the second fill

  m.ldirAt(0x066d, 0x066f); // ldir -- clear 0x8100-0x8162 to 0x00

  m.ret();
}
