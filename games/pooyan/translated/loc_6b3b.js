// SPDX-License-Identifier: GPL-3.0-only

// loc_6b3b  (ROM 0x6b3b-0x6bb1) -- deferred/"pending" object promoter. Bails unless (0x8806)==0,
// (0x8d5f)==0 and (0x8907) bit0==0. Reads the countdown at (0x8d5e): 0 -> ret; >1 -> dec it and ret;
// ==1 -> fire: arm sound/state ((0x880a)=(0x8d5f)=0x11, (0x8d5e)=0xff), then scan the 11 sprite
// blocks at 0x8ae0 (stride 0x18). For each block whose (ix+4)&0x1f is in [0x06,0x1a) it copies the
// block pointer + (ix+6) into the 0x8d80 list (3 bytes/entry, iy advances by 3) and clears (ix+6).
// Finally enqueues 5 display commands (0x062b-0x062f) via rst 0x38 (loc_0038) and tails into 0x02ef.
export function loc_6b3b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8806);          m.step(0x6b3e, 13);
  regs.and(regs.a);                    m.step(0x6b3f, 4);
  if (regs.fNZ) { return m.ret(11); }  // 6b3f  ret nz
  m.step(0x6b40, 5);
  regs.a = mem.read8(0x8d5f);          m.step(0x6b43, 13);
  regs.and(regs.a);                    m.step(0x6b44, 4);
  if (regs.fNZ) { return m.ret(11); }  // 6b44  ret nz
  m.step(0x6b45, 5);
  regs.a = mem.read8(0x8907);          m.step(0x6b48, 13);
  regs.and(0x01);                      m.step(0x6b4a, 7);
  if (regs.fNZ) { return m.ret(11); }  // 6b4a  ret nz
  m.step(0x6b4b, 5);
  regs.hl = 0x8d5e;                    m.step(0x6b4e, 10);
  regs.a = mem.read8(regs.hl);         m.step(0x6b4f, 7);
  regs.and(regs.a);                    m.step(0x6b50, 4);
  if (regs.fZ) { return m.ret(11); }   // 6b50  ret z -- countdown idle
  m.step(0x6b51, 5);
  regs.cp(0x01);                       m.step(0x6b53, 7);
  if (regs.fNZ) {
    m.step(0x6b55, 7);                 // jr z not taken -- countdown > 1
    regs.decMem8(mem, regs.hl);        m.step(0x6b56, 11); // dec (0x8d5e)
    return m.ret(10);                  // 6b56  ret
  }
  m.step(0x6b57, 12);                  // 6b53  jr z,0x6b57 -- countdown == 1, fire

  // loc_6b57: arm sound/state and scan the sprite table
  regs.a = 0x11;                       m.step(0x6b59, 7);
  mem.write8(0x880a, regs.a);          m.step(0x6b5c, 13);
  mem.write8(0x8d5f, regs.a);          m.step(0x6b5f, 13);
  regs.a = 0xff;                       m.step(0x6b61, 7);
  mem.write8(0x8d5e, regs.a);          m.step(0x6b64, 13);
  regs.de = 0x0018;                    m.step(0x6b67, 10);
  regs.ix = 0x8ae0;                    m.step(0x6b6b, 14);
  regs.iy = 0x8d80;                    m.step(0x6b6f, 14);
  regs.b = 0x0b;                       m.step(0x6b71, 7);

  for (;;) { // loc_6b71
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x6b74, 19);
    regs.and(0x1f);                    m.step(0x6b76, 7);
    regs.cp(0x06);                     m.step(0x6b78, 7);
    if (regs.fC) {
      m.step(0x6b97, 12);              // jr c,0x6b97 -- (ix+4)&0x1f < 0x06, skip
    } else {
      m.step(0x6b7a, 7);              // jr c not taken
      regs.cp(0x1a);                   m.step(0x6b7c, 7);
      if (regs.fNC) {
        m.step(0x6b97, 12);            // jr nc,0x6b97 -- >= 0x1a, skip
      } else {
        m.step(0x6b7e, 7);            // jr nc not taken -- in range, copy the block
        m.push16(regs.ix);             m.step(0x6b80, 15); // push ix
        regs.hl = m.pop16();           m.step(0x6b81, 10); // pop hl -> HL = IX
        mem.write8((regs.iy + 0x00) & 0xffff, regs.l); m.step(0x6b84, 19);
        mem.write8((regs.iy + 0x01) & 0xffff, regs.h); m.step(0x6b87, 19);
        regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x6b8a, 19);
        mem.write8((regs.iy + 0x02) & 0xffff, regs.a); m.step(0x6b8d, 19);
        mem.write8((regs.ix + 0x06) & 0xffff, 0x00);   m.step(0x6b91, 19);
        regs.iy = (regs.iy + 1) & 0xffff; m.step(0x6b93, 10);
        regs.iy = (regs.iy + 1) & 0xffff; m.step(0x6b95, 10);
        regs.iy = (regs.iy + 1) & 0xffff; m.step(0x6b97, 10);
      }
    }
    // loc_6b97
    regs.addIx(regs.de);               m.step(0x6b99, 15);
    if (regs.djnz()) { m.step(0x6b71, 13); continue; }
    m.step(0x6b9b, 8);
    break;
  }

  // loc_6b9b: enqueue 5 display commands, then tail into 0x02ef
  regs.de = 0x062b;                    m.step(0x6b9e, 10);
  m.push16(0x6b9f);
  m.step(0x0038, 11);                  // 6b9e  rst 0x38 (loc_0038)
  m.call(0x0038);
  regs.de = 0x062c;                    m.step(0x6ba2, 10);
  m.push16(0x6ba3);
  m.step(0x0038, 11);                  // 6ba2  rst 0x38
  m.call(0x0038);
  regs.de = 0x062d;                    m.step(0x6ba6, 10);
  m.push16(0x6ba7);
  m.step(0x0038, 11);                  // 6ba6  rst 0x38
  m.call(0x0038);
  regs.de = 0x062e;                    m.step(0x6baa, 10);
  m.push16(0x6bab);
  m.step(0x0038, 11);                  // 6baa  rst 0x38
  m.call(0x0038);
  regs.de = 0x062f;                    m.step(0x6bae, 10);
  m.push16(0x6baf);
  m.step(0x0038, 11);                  // 6bae  rst 0x38
  m.call(0x0038);
  m.step(0x02ef, 10);                  // 6baf  jp 0x02ef (tail)
  return m.call(0x02ef);
}
