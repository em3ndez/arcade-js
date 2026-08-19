// SPDX-License-Identifier: GPL-3.0-only

// loc_3865  (ROM 0x3865-0x38a4) -- actor state handler (rst-0x28 dispatch target; entry
// dw 0x3865 in the tables at 0x123d and 0x339b). Runs the animation player (0x4006), then
// counts a per-actor timer (ix+0x11) down; while it is non-zero it just returns. On expiry it
// advances the actor's sub-state (ix+0x02), clears bit0 of (ix+0x08), and -- only when the
// actor's screen position (IX) has reached >= 0x8b70 and the global gate (0x8a5f) is clear --
// walks a wrapping-sum ROM checksum backward from 0x4282 to the 0x1a terminator. When
// (E + C) & 0x9e is non-zero it bumps the tamper counter at 0x8ef0.
export function loc_3865(m) {
  const { regs, mem } = m;

  m.push16(0x3868);
  m.step(0x4006, 17); // 3865  call 0x4006 -- run the animation player
  m.call(0x4006);

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x386b, 23); // 3868  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 386b  ret nz -- timer still running
  m.step(0x386c, 5);

  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x386f, 23); // 386c  inc (ix+0x02)
  const ea08 = (regs.ix + 0x08) & 0xffff;
  mem.write8(ea08, regs.res(0, mem.read8(ea08)));
  m.step(0x3873, 23); // 386f  res 0,(ix+0x08)
  m.push16(regs.ix);
  m.step(0x3875, 15); // 3873  push ix
  regs.hl = m.pop16();
  m.step(0x3876, 10); // 3875  pop hl -- HL = IX (actor screen ptr)
  regs.a = regs.h;
  m.step(0x3877, 4); // 3876  ld a,h
  regs.cp(0x8b);
  m.step(0x3879, 7); // 3877  cp 0x8b
  if (regs.fC) { m.ret(11); return; } // 3879  ret c -- above the trigger band
  m.step(0x387a, 5);
  regs.a = regs.l;
  m.step(0x387b, 4); // 387a  ld a,l
  regs.cp(0x70);
  m.step(0x387d, 7); // 387b  cp 0x70
  if (regs.fC) { m.ret(11); return; } // 387d  ret c
  m.step(0x387e, 5);

  regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
  m.step(0x3881, 23); // 387e  dec (ix+0x04)
  regs.decMem8(mem, (regs.ix + 0x06) & 0xffff);
  m.step(0x3884, 23); // 3881  dec (ix+0x06)
  regs.a = mem.read8(0x8a5f);
  m.step(0x3887, 13); // 3884  ld a,(0x8a5f)
  regs.and(regs.a);
  m.step(0x3888, 4); // 3887  and a
  if (regs.fNZ) { m.ret(11); return; } // 3888  ret nz
  m.step(0x3889, 5);

  regs.hl = 0x4282;
  m.step(0x388c, 10); // 3889  ld hl,0x4282
  regs.c = 0x00;
  m.step(0x388e, 7); // 388c  ld c,0x00
  regs.e = regs.c;
  m.step(0x388f, 4); // 388e  ld e,c

  for (;;) {
    // 388f  wrapping sum backward: C = running sum, E = carry count, stop when (hl)==0x1a
    regs.a = mem.read8(regs.hl);
    m.step(0x3890, 7); // 388f  ld a,(hl)
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x3891, 6); // 3890  dec hl
    regs.add(regs.c);
    m.step(0x3892, 4); // 3891  add a,c
    regs.c = regs.a;
    m.step(0x3893, 4); // 3892  ld c,a
    if (regs.fNC) {
      m.step(0x3896, 12); // 3893  jr nc,0x3896
    } else {
      m.step(0x3895, 7);
      regs.e = regs.inc8(regs.e);
      m.step(0x3896, 4); // 3895  inc e
    }
    regs.a = 0x1a;
    m.step(0x3898, 7); // 3896  ld a,0x1a
    regs.cp(mem.read8(regs.hl));
    m.step(0x3899, 7); // 3898  cp (hl)
    if (regs.fNZ) { m.step(0x388f, 12); continue; } // 3899  jr nz,0x388f
    m.step(0x389b, 7);
    break;
  }

  regs.a = regs.e;
  m.step(0x389c, 4); // 389b  ld a,e
  regs.add(regs.c);
  m.step(0x389d, 4); // 389c  add a,c
  regs.and(0x9e);
  m.step(0x389f, 7); // 389d  and 0x9e
  if (regs.fZ) { m.ret(11); return; } // 389f  ret z -- checksum clean
  m.step(0x38a0, 5);
  regs.hl = 0x8ef0;
  m.step(0x38a3, 10); // 38a0  ld hl,0x8ef0
  regs.incMem8(mem, regs.hl);
  m.step(0x38a4, 11); // 38a3  inc (hl) -- tamper counter++
  m.ret(); // 38a4  ret
}
