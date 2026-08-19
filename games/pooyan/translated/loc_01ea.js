// SPDX-License-Identifier: GPL-3.0-only

// loc_01ea  (ROM 0x01EA-0x020E) -- clears both sprite banks and blanks the
// video-RAM tail, then runs a 256x256 watchdog-kicked settle delay and returns.
// rst 0x10 (loc_0010) is the "fill B bytes at HL with A" helper.
export function loc_01ea(m) {
  const { regs, mem } = m;

  regs.hl = 0x9410; // sprite bank 1
  m.step(0x01ed, 10);
  regs.b = 0x30;
  m.step(0x01ef, 7);
  m.push16(0x01f0);
  m.step(0x0010, 11); // rst 0x10
  m.call(0x0010);

  regs.hl = 0x9010; // sprite bank 0
  m.step(0x01f3, 10);
  regs.b = 0x30;
  m.step(0x01f5, 7);
  m.push16(0x01f6);
  m.step(0x0010, 11); // rst 0x10
  m.call(0x0010);

  regs.hl = 0x8440; // blank video RAM 0x8440-0x87FF with tile 0x1e
  m.step(0x01f9, 10);
  regs.de = 0x8441;
  m.step(0x01fc, 10);
  regs.bc = 0x03bf;
  m.step(0x01ff, 10);
  mem.write8(regs.hl, 0x1e);
  m.step(0x0201, 10);
  m.ldirAt(0x0201, 0x0203);

  // 0203: inner djnz(B) x256 nested in outer dec-c(C) x256; both counters exit
  // the ldir at 0, and the watchdog at 0xA000 is kicked once per outer pass.
  for (;;) {
    for (;;) {
      m.step(0x0204, 4);
      m.step(0x0205, 4);
      m.step(0x0206, 4);
      if (regs.djnz() !== 0) {
        m.step(0x0203, 13);
        continue;
      }
      m.step(0x0208, 8);
      break;
    }
    mem.write8(0xa000, regs.a); // watchdog kick
    m.step(0x020b, 13);
    regs.c = regs.dec8(regs.c);
    m.step(0x020c, 4);
    if (regs.fNZ) {
      m.step(0x0203, 12);
      continue;
    }
    m.step(0x020e, 7);
    break;
  }
  m.ret(); // 020e ret
}
