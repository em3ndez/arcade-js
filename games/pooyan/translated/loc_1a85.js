// SPDX-License-Identifier: GPL-3.0-only

// loc_1a85  (ROM 0x1a85-0x1a95) -- call 0x03c2, then set (0x880a) = 0x0a, bumped to 0x0b when the
// two-player flag (0x880d) is non-zero. Selects the active-player scratch base for downstream code.
export function loc_1a85(m) {
  const { regs, mem } = m;

  m.push16(0x1a88);            m.step(0x03c2, 17); // call 0x03c2
  m.call(0x03c2);
  regs.c = 0x0a;              m.step(0x1a8a, 7);
  regs.a = mem.read8(0x880d); m.step(0x1a8d, 13);
  regs.and(regs.a);          m.step(0x1a8e, 4);
  if (regs.fZ) {
    m.step(0x1a91, 12);      // jr z,0x1a91 taken -- one-player, C stays 0x0a
  } else {
    m.step(0x1a90, 7);
    regs.c = regs.inc8(regs.c); m.step(0x1a91, 4); // inc c -> 0x0b
  }
  regs.a = regs.c;           m.step(0x1a92, 4);
  mem.write8(0x880a, regs.a); m.step(0x1a95, 13);
  m.ret(10);
}
