// SPDX-License-Identifier: GPL-3.0-only

// loc_73e3  (ROM 0x73e3-0x7402) -- eagle idle/between-waves handler (reached via jp z from 0x72b6).
// While the (0x8f36) hold is non-zero it ticks it and returns. On expiry, if a wave index (0x8f3d)
// is still set it queues sound 0x06b0+(0x8f3d) (rst 0x38); then it reseeds the hold (0x8f36)=0x18 and
// clears the launch flag (0x8f3a).
export function loc_73e3(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f36;
  m.step(0x73e6, 10); // 73e3  ld hl,0x8f36
  regs.a = mem.read8(regs.hl);
  m.step(0x73e7, 7); // 73e6  ld a,(hl)
  regs.and(regs.a);
  m.step(0x73e8, 4); // 73e7  and a
  if (regs.fZ) {
    m.step(0x73ec, 12); // 73e8  jr z,0x73ec
  } else {
    m.step(0x73ea, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x73eb, 11); // 73ea  dec (hl)
    m.ret(); // 73eb  ret
    return;
  }
  regs.a = mem.read8(0x8f3d);
  m.step(0x73ef, 13); // 73ec  ld a,(0x8f3d)
  regs.and(regs.a);
  m.step(0x73f0, 4); // 73ef  and a
  if (regs.fZ) {
    m.step(0x73f8, 12); // 73f0  jr z,0x73f8
  } else {
    m.step(0x73f2, 7);
    regs.de = 0x06b0;
    m.step(0x73f5, 10); // 73f2  ld de,0x06b0
    regs.add(regs.e);
    m.step(0x73f6, 4); // 73f5  add a,e
    regs.e = regs.a;
    m.step(0x73f7, 4); // 73f6  ld e,a
    m.push16(0x73f8);
    m.step(0x0038, 11); // 73f7  rst 0x38 -- queue sound 0x06b0+(0x8f3d)
    m.call(0x0038);
  }
  regs.a = 0x18;
  m.step(0x73fa, 7); // 73f8  ld a,0x18
  mem.write8(0x8f36, regs.a);
  m.step(0x73fd, 13); // 73fa  ld (0x8f36),a
  regs.xor(regs.a);
  m.step(0x73fe, 4); // 73fd  xor a
  regs.hl = 0x8f3a;
  m.step(0x7401, 10); // 73fe  ld hl,0x8f3a
  mem.write8(regs.hl, regs.a);
  m.step(0x7402, 7); // 7401  ld (hl),a -- clear launch flag
  m.ret(); // 7402  ret
}
