// SPDX-License-Identifier: GPL-3.0-only

// loc_4103  (ROM 0x4103-0x4136) -- per-object frame-advance step; object block based at IX.
// loc_4006 animates the object, then (ix+11h) is a dwell countdown -- while non-zero, return.
// On expiry: bump the phase (ix+02h), clear (ix+13h), and only when 0x8a5f reads zero, scan the
// low nibbles of 0x38 bytes at 0x557f accumulating DE (E=sum lo byte, D=carry count). If that
// checksum is the sentinel (E==0x67 and 1-D==0, i.e. D==1) return without side effect; otherwise
// bump the 0x8a38 counter and return.
export function loc_4103(m) {
  const { regs, mem } = m;

  m.push16(0x4106);
  m.step(0x4006, 17);                                             // 4103  call 0x4006
  m.call(0x4006);
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);  m.step(0x4109, 23); // 4106  dec (ix+11h)
  if (regs.fNZ) { return m.ret(11); }                            // 4109  ret nz -- still dwelling
  m.step(0x410a, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);  m.step(0x410d, 23); // 410a  inc (ix+02h)
  mem.write8((regs.ix + 0x13) & 0xffff, 0x00);   m.step(0x4111, 19); // 410d  ld (ix+13h),0
  regs.a = mem.read8(0x8a5f);    m.step(0x4114, 13);             // 4111  ld a,(0x8a5f)
  regs.and(regs.a);              m.step(0x4115, 4);
  if (regs.fNZ) { return m.ret(11); }                            // 4115  ret nz
  m.step(0x4116, 5);
  regs.hl = 0x557f;             m.step(0x4119, 10);
  regs.b = 0x38;               m.step(0x411b, 7);
  regs.xor(regs.a);            m.step(0x411c, 4);
  regs.d = regs.a;             m.step(0x411d, 4);
  regs.e = regs.d;             m.step(0x411e, 4);

  for (;;) { // loc_411e: DE += low nibble of each byte
    regs.a = mem.read8(regs.hl); m.step(0x411f, 7);
    regs.and(0x0f);            m.step(0x4121, 7);
    regs.add(regs.e);         m.step(0x4122, 4);
    regs.e = regs.a;          m.step(0x4123, 4);
    if (regs.fC) {
      m.step(0x4125, 7);                                         // 4123  jr nc not taken -- carry up
      regs.d = regs.inc8(regs.d); m.step(0x4126, 4);
    } else {
      m.step(0x4126, 12);                                        // 4123  jr nc taken
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x4127, 6);
    if (regs.djnz()) { m.step(0x411e, 13); } else { m.step(0x4129, 8); break; }
  }

  regs.a = 0x67;               m.step(0x412b, 7);
  regs.cp(regs.e);             m.step(0x412c, 4);
  if (regs.fZ) {
    m.step(0x412e, 7);                                           // 412c  jr nz not taken -- E==0x67
    regs.a = 0x01;             m.step(0x4130, 7);
    regs.sub(regs.d);          m.step(0x4131, 4);
    if (regs.fZ) { return m.ret(11); }                          // 4131  ret z -- sentinel (D==1)
    m.step(0x4132, 5);
  } else {
    m.step(0x4132, 12);                                          // 412c  jr nz taken
  }
  regs.hl = 0x8a38;            m.step(0x4135, 10);
  regs.incMem8(mem, regs.hl);  m.step(0x4136, 11);               // 4135  inc (hl)
  return m.ret(10);
}
