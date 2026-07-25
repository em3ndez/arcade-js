// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0ae8  (ROM 0x0AE8–0x0B05).
 */
export function loc_0ae8(m) {
  const { regs, mem } = m;

  m.push16(0x0aeb);
  m.step(0x306f, 17);
  m.call(0x306f);

  regs.a = mem.read8(0x62af);
  m.step(0x0aee, 13); // ld a,(0x62af)
  regs.and(0x0f);
  m.step(0x0af0, 7); // and 0x0f

  if (regs.fZ) {
    m.push16(0x0af3);
    m.step(0x304a, 17); // call z,0x304a taken
    m.call(0x304a);
  } else {
    m.step(0x0af3, 10); // call z NOT taken
  }

  regs.a = mem.read8(0x690b);
  m.step(0x0af6, 13); // ld a,(0x690b)
  regs.cp(0x5d);
  m.step(0x0af8, 7); // cp 0x5d
  if (regs.fNC) {
    m.ret(11); // ret nc -- 0x690B >= 0x5D
    return;
  }
  m.step(0x0af9, 5); // ret nc NOT taken

  regs.a = 0x20;
  m.step(0x0afb, 7); // ld a,0x20
  mem.write8(0x6009, regs.a); // arm countdown to 32
  m.step(0x0afe, 13); // ld (0x6009),a
  regs.hl = 0x6385;
  m.step(0x0b01, 10); // ld hl,0x6385
  regs.incMem8(mem, regs.hl); // inc (hl) -- HL stays 0x6385
  m.step(0x0b02, 11);
  mem.write16(0x63c0, regs.hl); // seed the 0x63C0 pointer
  m.step(0x0b05, 16); // ld (0x63c0),hl
  m.ret(); // ret (0x0B05)
}
