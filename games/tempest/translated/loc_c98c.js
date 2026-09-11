// SPDX-License-Identifier: GPL-3.0-only
// loc_c98c  (ROM 0xc98c-0xc9ae) -- if $46,x < 0x62 bump it and $9f; set $00=0x18; when $0102,x!=0 run the
// jsr $91b5 / ldx #$ff+jsr $ca6c / jsr $ccb9 chain; then tail-jmp $9009.
export function loc_c98c(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc98e, 3);// c98c ldx $3d
  regs.a = mem.read8((0x46 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc990, 4);
  regs.cmp(0x62); m.step(0xc992, 2);
  if (regs.fC) {
    m.step(0xc998, 3);
  } else {
    m.step(0xc994, 2);
    mem.write8((0x46 + regs.x) & 0xff, regs.inc8(mem.read8((0x46 + regs.x) & 0xff))); m.step(0xc996, 6);
    mem.write8(0x9f, regs.inc8(mem.read8(0x9f))); m.step(0xc998, 5);
  }
  regs.a = 0x18; regs.setNZ(regs.a); m.step(0xc99a, 2);
  mem.write8(0x00, regs.a); m.step(0xc99c, 3);
  regs.a = mem.read8((0x0102 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc99f, 4);
  if (regs.fZ) {
    m.step(0xc9ac, 3);
  } else {
    m.step(0xc9a1, 2);
    m.push16(0xc9a3); m.step(0xc9a4, 6); m.call(0x91b5);
    regs.x = 0xff; regs.setNZ(regs.x); m.step(0xc9a6, 2);
    m.push16(0xc9a8); m.step(0xc9a9, 6); m.call(0xca6c);
    m.push16(0xc9ab); m.step(0xc9ac, 6); m.call(0xccb9);
  }
  m.step(0x9009, 3); return m.call(0x9009);
}
