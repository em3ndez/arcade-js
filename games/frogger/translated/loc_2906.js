// SPDX-License-Identifier: GPL-3.0-only

// loc_2906  (ROM 0x2906-0x291C) — frog-on-log edge blit. Bails unless the play flag (0x83FE) is set,
// (0x81A2) is in [0x02,0x0E], and (0x8140)==0; then enqueues tile/sound command 0xD0 via rst 0x18.
export function loc_2906(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fe);
  m.step(0x2909, 13);
  regs.and(regs.a);
  m.step(0x290a, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- not playing
    return;
  }
  m.step(0x290b, 5);

  regs.a = mem.read8(0x81a2);
  m.step(0x290e, 13);
  regs.cp(0x0f);
  m.step(0x2910, 7);
  if (regs.fNC) {
    m.ret(11); // ret nc -- (0x81a2) >= 0x0f
    return;
  }
  m.step(0x2911, 5);
  regs.cp(0x02);
  m.step(0x2913, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- (0x81a2) < 0x02
    return;
  }
  m.step(0x2914, 5);

  regs.a = mem.read8(0x8140);
  m.step(0x2917, 13);
  regs.and(regs.a);
  m.step(0x2918, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- (0x8140) busy
    return;
  }
  m.step(0x2919, 5);

  regs.a = 0xd0;
  m.step(0x291b, 7); // A = the blit command
  m.push16(0x291c);
  m.step(0x0018, 11); // rst 0x18
  m.call(0x0018);
  m.ret();
}
