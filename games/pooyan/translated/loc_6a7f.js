// SPDX-License-Identifier: GPL-3.0-only

// loc_6a7f  (ROM 0x6a7f-0x6b09) -- per-frame object driver / one-shot tilemap integrity check.
// When (0x892b)!=0: walk 18 records at 0x8ae0 (stride 0x18), running per-object handler loc_6a98 for
// each (exx brackets the call so the loop counter B / stride DE survive the callee). When (0x892b)==0
// and (0x892d)==2, once (latch 0x8f56): sum the tilemap from 0x8450 (skip col 0x1b, rows step +0x12,
// stop at h>=0x88) into DE; expected 0x29b8. Both fail arms are anti-tamper traps unreachable with a
// valid tilemap: 0x3829 is data (cf. loc_68ac / loc_3278, which trap on the same address); 0x0929
// decodes as code but is reached only by this routine's own fail arm (0x6b00), never by normal flow.
// This is a WORK-RAM checksum, so a firing implies a port bug -- throw, don't delegate.
export function loc_6a7f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x892b);  m.step(0x6a82, 13);
  regs.and(regs.a);            m.step(0x6a83, 4);
  if (regs.fZ) {
    m.step(0x6ac5, 12);        // 6a83  jr z -> integrity arm

    regs.a = mem.read8(0x892d); m.step(0x6ac8, 13);
    regs.cp(0x02);             m.step(0x6aca, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x6acb, 5);
    regs.a = mem.read8(0x8f56); m.step(0x6ace, 13);
    regs.and(regs.a);          m.step(0x6acf, 4);
    if (regs.fNZ) { m.ret(11); return; }   // 6acf  already run this pass
    m.step(0x6ad0, 5);
    regs.a = regs.inc8(regs.a); m.step(0x6ad1, 4);
    mem.write8(0x8f56, regs.a); m.step(0x6ad4, 13);   // latch <- 1
    regs.hl = 0x8450;          m.step(0x6ad7, 10);
    regs.de = 0x0000;          m.step(0x6ada, 10);

    for (;;) { // 6ada: accumulate tilemap into DE
      regs.a = regs.e;              m.step(0x6adb, 4);
      regs.add(mem.read8(regs.hl)); m.step(0x6adc, 7);
      regs.e = regs.a;             m.step(0x6add, 4);
      if (regs.fNC) {
        m.step(0x6ae0, 12);
      } else {
        m.step(0x6adf, 7);
        regs.d = regs.inc8(regs.d); m.step(0x6ae0, 4); // carry into D
      }
      regs.l = regs.inc8(regs.l);  m.step(0x6ae1, 4);
      regs.a = regs.l;             m.step(0x6ae2, 4);
      regs.and(0x1f);              m.step(0x6ae4, 7);
      regs.cp(0x1b);               m.step(0x6ae6, 7);
      if (regs.fZ) {
        m.step(0x6ae8, 7);
        regs.l = regs.inc8(regs.l); m.step(0x6ae9, 4); // skip col 0x1b
        m.step(0x6ada, 12); continue;
      }
      m.step(0x6aeb, 12);
      regs.cp(0x1f);               m.step(0x6aed, 7);
      if (regs.fNZ) { m.step(0x6ada, 12); continue; }
      m.step(0x6aef, 7);
      regs.a = 0x12;               m.step(0x6af1, 7);
      regs.add(regs.l);            m.step(0x6af2, 4);
      regs.l = regs.a;             m.step(0x6af3, 4); // next row = l + 0x12
      if (regs.fNC) { m.step(0x6ada, 12); continue; }
      m.step(0x6af5, 7);
      regs.h = regs.inc8(regs.h);  m.step(0x6af6, 4);
      regs.a = regs.h;             m.step(0x6af7, 4);
      regs.cp(0x88);               m.step(0x6af9, 7);
      if (regs.fC) { m.step(0x6ada, 12); continue; }
      m.step(0x6afb, 7);
      break;
    }

    regs.a = regs.e;             m.step(0x6afc, 4);
    regs.cp(0xb8);               m.step(0x6afe, 7);
    if (regs.fNZ) {
      m.step(0x6b00, 7);
      // 6b00  jp 0x0929 -- tamper trap, unreachable with a valid tilemap (sum 0x29b8); 0x0929 is
      // reached only by this fail arm, never by normal flow (cf. loc_68ac / loc_3278)
      throw new Error("loc_6a7f: tilemap integrity checksum failed (E low-byte no match) -- 0x0929 tamper-response, unreachable with a valid tilemap");
    }
    m.step(0x6b03, 12);
    regs.a = regs.d;             m.step(0x6b04, 4);
    regs.cp(0x29);               m.step(0x6b06, 7);
    if (regs.fNZ) {
      // 6b06  jp nz 0x3829 (data) -- tamper trap, unreachable with a valid tilemap (cf. loc_68ac / loc_3278)
      throw new Error("loc_6a7f: tilemap integrity checksum failed (D high-byte no match) -- 0x3829 is data");
    }
    m.step(0x6b09, 10);
    m.ret();
    return;
  }
  m.step(0x6a85, 7);             // 6a83  jr z not taken

  regs.ix = 0x8ae0;             m.step(0x6a89, 14);
  regs.de = 0x0018;            m.step(0x6a8c, 10);
  regs.b = 0x12;               m.step(0x6a8e, 7);
  for (;;) { // 6a8e: 18 records, stride 0x18
    regs.exx();                m.step(0x6a8f, 4);
    m.push16(0x6a92); m.step(0x6a98, 17); m.call(0x6a98);
    regs.exx();                m.step(0x6a93, 4);
    regs.addIx(regs.de);       m.step(0x6a95, 15);
    if (regs.djnz() !== 0) { m.step(0x6a8e, 13); continue; }
    m.step(0x6a97, 8);
    break;
  }
  m.ret();
}
