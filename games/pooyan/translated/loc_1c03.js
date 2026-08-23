// SPDX-License-Identifier: GPL-3.0-only

// loc_1c03  (ROM 0x1c03-0x1c52) -- play-state 0x15a8 dispatch handler: a (0x8808) phase-timer gate that on
// expiry plays 3 sounds (loc_05b2), paints a column strip (loc_075d) + its frame (loc_03e9), enqueues a
// display command, advances the play sub-state (0x880a)=0x0e, then -- only if (0x89fc)!=0 -- builds the
// (0x89fd) stride-2 pointer from 0x8045 and copies the 0x1754 table (rl a per byte) into 0x89f0.. until 0x5a.
export function loc_1c03(m) {
  const { regs, mem } = m;

  regs.hl = 0x8808;                       m.step(0x1c06, 10);
  regs.decMem8(mem, regs.hl);             m.step(0x1c07, 11); // dec (hl) -- phase timer
  if (regs.fNZ) { m.ret(11); return; }    // 1c07  ret nz -- not expired
  m.step(0x1c08, 5);

  regs.a = 0x82;                          m.step(0x1c0a, 7);
  m.push16(0x1c0d); m.step(0x05b2, 17); m.call(0x05b2);
  regs.a = 0x80;                          m.step(0x1c0f, 7);
  m.push16(0x1c12); m.step(0x05b2, 17); m.call(0x05b2);
  regs.a = 0x89;                          m.step(0x1c14, 7);
  m.push16(0x1c17); m.step(0x05b2, 17); m.call(0x05b2);
  regs.bc = 0x07d9;                       m.step(0x1c1a, 10);
  m.push16(0x1c1d); m.step(0x075d, 17); m.call(0x075d);
  m.push16(0x1c20); m.step(0x03e9, 17); m.call(0x03e9);
  regs.de = 0x0611;                       m.step(0x1c23, 10);
  m.push16(0x1c24); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 -- enqueue display command
  regs.hl = 0x880a;                       m.step(0x1c27, 10);
  mem.write8(regs.hl, 0x0e);              m.step(0x1c29, 10); // (0x880a)=0x0e -- advance play sub-state
  regs.a = mem.read8(0x89fc);             m.step(0x1c2c, 13);
  regs.and(regs.a);                       m.step(0x1c2d, 4);
  if (regs.fZ) { m.ret(11); return; }     // 1c2d  ret z -- (0x89fc) clear
  m.step(0x1c2e, 5);

  regs.hl = 0x8045;                       m.step(0x1c31, 10);
  regs.b = regs.a;                        m.step(0x1c32, 4);
  for (;;) { // advance hl by 2 per (0x89fc) step
    regs.l = regs.inc8(regs.l);           m.step(0x1c33, 4);
    regs.l = regs.inc8(regs.l);           m.step(0x1c34, 4);
    if (regs.djnz() !== 0) { m.step(0x1c32, 13); continue; }
    m.step(0x1c36, 8);
    break;
  }
  mem.write16(0x89fd, regs.hl);           m.step(0x1c39, 16);
  m.push16(0x1c3c); m.step(0x0fc1, 17); m.call(0x0fc1);
  regs.hl = 0x89ff;                       m.step(0x1c3f, 10);
  mem.write8(regs.hl, 0x07);              m.step(0x1c41, 10);
  regs.de = 0x1754;                       m.step(0x1c44, 10);
  regs.hl = 0x89f0;                       m.step(0x1c47, 10);
  for (;;) { // copy the 0x1754 table (rl a per byte) into 0x89f0.. until the 0x5a terminator
    regs.a = mem.read8(regs.de);          m.step(0x1c48, 7);
    regs.cp(0x5a);                        m.step(0x1c4a, 7);
    if (regs.fZ) { m.ret(11); return; }   // 1c4a  ret z -- terminator
    m.step(0x1c4b, 5);
    regs.a = regs.rl(regs.a);             m.step(0x1c4d, 8);
    mem.write8(regs.hl, regs.a);          m.step(0x1c4e, 7);
    regs.de = (regs.de + 1) & 0xffff;     m.step(0x1c4f, 6);
    regs.hl = (regs.hl + 1) & 0xffff;     m.step(0x1c50, 6);
    m.step(0x1c47, 12);
  }
  // 0x1c52 ret is unreachable: the 0x1c50 jr is unconditional; the loop exits only via the ret z above.
}
