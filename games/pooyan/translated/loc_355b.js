// SPDX-License-Identifier: GPL-3.0-only

// loc_355b  (ROM 0x355b-0x35c6) -- actor movement/AI step. After a setup call (0x4006), bails if the
// actor is already latched (ix+8 != 0 -> 0x3757). Advances the actor's X (ix+5 += ix+9, carry bumps
// ix+6), then bails while level (0x8901) < 3 (-> 0x362d). Picks a target column into C two ways:
// (0x8d79)==0 -> table 0x35c7 keyed by (0x8907)>>1 via loc_0c45 + (0x8d41)&7 (rst 0x20); else an
// alternate source at (0x8d6f)/(0x8d7b) (or, when (ix+7) bit2 clear, skip straight to the range gate).
// If the actor already sits on the target column -> 0x3617; else if column < 0x14 -> ret; else latch
// (ix+8)=1, pick vector 0x3838/0x3856 per (ix+7) bit1, tail 0x381e. Table 0x35c7 is inline data.
export function loc_355b(m) {
  const { regs, mem } = m;

  m.push16(0x355e); m.step(0x4006, 17); m.call(0x4006);          // 355b  call 0x4006
  regs.a = mem.read8((regs.ix + 0x08) & 0xffff);  m.step(0x3561, 19);
  regs.and(regs.a);                               m.step(0x3562, 4);
  if (regs.fNZ) { m.step(0x3757, 10); return m.call(0x3757); }   // jp nz,0x3757 (tail, boundary)
  m.step(0x3565, 10);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);  m.step(0x3568, 19);
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x356b, 19);
  if (regs.fNC) {
    m.step(0x3570, 12);                           // jr nc,0x3570 taken
  } else {
    m.step(0x356d, 7);                            // jr nc not taken -- X carried into ix+6
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3570, 23);
  }
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);  m.step(0x3573, 19);
  regs.b = regs.a;                                m.step(0x3574, 4);
  regs.a = mem.read8(0x8901);                     m.step(0x3577, 13);
  regs.cp(0x03);                                  m.step(0x3579, 7);
  if (regs.fC) { m.step(0x362d, 10); return m.call(0x362d); }    // jp c,0x362d (tail, boundary)
  m.step(0x357c, 10);
  regs.a = mem.read8(0x8d79);                     m.step(0x357f, 13);
  regs.and(regs.a);                               m.step(0x3580, 4);

  let enter359e = false;
  if (regs.fNZ) {
    m.step(0x35b4, 12);                           // jr nz,0x35b4 -- alternate target source
    regs.bit(2, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x35b8, 20);
    if (regs.fZ) {
      m.step(0x35c2, 12);                         // jr z,0x35c2 -- skip lookup, use ix+6
      regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x35c5, 19);
      m.step(0x359e, 12);                         // jr 0x359e
      enter359e = true;
    } else {
      m.step(0x35ba, 7);                          // jr z not taken
      regs.hl = mem.read16(0x8d6f);               m.step(0x35bd, 16);
      regs.a = mem.read8(0x8d7b);                 m.step(0x35c0, 13);
      m.step(0x3595, 12);                         // jr 0x3595
    }
  } else {
    m.step(0x3582, 7);                            // jr nz not taken -- primary table lookup
    regs.hl = 0x35c7;                             m.step(0x3585, 10);
    regs.a = mem.read8(0x8907);                   m.step(0x3588, 13);
    regs.and(0x0f);                               m.step(0x358a, 7);
    regs.a = regs.srl(regs.a);                    m.step(0x358c, 8);
    m.push16(0x358f); m.step(0x0c45, 17); m.call(0x0c45); // call 0x0c45 -- DE = table[A]
    regs.exDeHl();                                m.step(0x3590, 4);
    regs.a = mem.read8(0x8d41);                   m.step(0x3593, 13);
    regs.and(0x07);                               m.step(0x3595, 7);
  }

  if (!enter359e) {
    // loc_3595: rst 0x20 keyed lookup -> C, compare with the actor column (ix+6)
    m.push16(0x3596); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = (HL+A)
    regs.c = regs.a;                              m.step(0x3597, 4);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x359a, 19);
    regs.cp(regs.c);                              m.step(0x359b, 4);
    if (regs.fZ) { m.step(0x3617, 10); return m.call(0x3617); } // jp z,0x3617 (tail, boundary)
    m.step(0x359e, 10);
  }

  // loc_359e: range gate then vector dispatch
  regs.cp(0x14);                                  m.step(0x35a0, 7);
  if (regs.fC) { m.ret(11); return; }             // ret c (column < 0x14)
  m.step(0x35a1, 5);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x01);    m.step(0x35a5, 19);
  regs.de = 0x3838;                               m.step(0x35a8, 10);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x35ac, 20);
  if (regs.fZ) {
    m.step(0x35b1, 12);                           // jr z,0x35b1 taken -- keep 0x3838
  } else {
    m.step(0x35ae, 7);                            // jr z not taken
    regs.de = 0x3856;                             m.step(0x35b1, 10);
  }
  m.step(0x381e, 10);                             // jp 0x381e (tail)
  return m.call(0x381e);
}
