// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0abf  (ROM 0x0ABF–0x0AE7).
 */
export function loc_0abf(m) {
  const { regs, mem } = m;

  m.push16(0x0ac0);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // countdown not expired -- aborted to caller

  regs.hl = 0x388c;
  m.step(0x0ac3, 10); // ld hl,0x388c
  m.push16(0x0ac6);
  m.step(0x004e, 17);
  m.call(0x004e); // copy 0x28 bytes ROM 0x388C -> 0x6908

  regs.hl = 0x6908;
  m.step(0x0ac9, 10); // ld hl,0x6908
  regs.c = 0x30;
  m.step(0x0acb, 7); // ld c,0x30
  m.push16(0x0acc);
  m.step(0x0038, 11); // rst 0x38 -- add-pass 1
  m.call(0x0038);

  regs.hl = 0x690b;
  m.step(0x0acf, 10); // ld hl,0x690b
  regs.c = 0x99;
  m.step(0x0ad1, 7); // ld c,0x99
  m.push16(0x0ad2);
  m.step(0x0038, 11); // rst 0x38 -- add-pass 2 (different HL, C)
  m.call(0x0038);

  regs.a = 0x1f;
  m.step(0x0ad4, 7); // ld a,0x1f
  mem.write8(0x638e, regs.a);
  m.step(0x0ad7, 13); // ld (0x638e),a
  regs.xor(regs.a); // A = 0
  m.step(0x0ad8, 4);
  mem.write8(0x690c, regs.a);
  m.step(0x0adb, 13); // ld (0x690c),a

  regs.hl = 0x608a;
  m.step(0x0ade, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x01); // 0x608A = 1
  m.step(0x0ae0, 10); // ld (hl),0x01
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0ae1, 6); // inc hl
  mem.write8(regs.hl, 0x03); // 0x608B = 3
  m.step(0x0ae3, 10); // ld (hl),0x03

  regs.hl = 0x6385;
  m.step(0x0ae6, 10); // ld hl,0x6385
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the sequence
  m.step(0x0ae7, 11);
  m.ret(); // ret (0x0AE7)
}
