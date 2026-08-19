// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2856  (ROM 0x2856-0x28ac) -- 0x8f30 state 2 (dispatch 0x277e[2]). Unless (0x8f50) is set, it
// finds the first empty slot in the 6-entry 0x8c78 hunter table (0x18-byte records, stepping DE=
// 0xffe8) and seeds a new hunter (state/anim/coords/tiles at +1..+0x10), recording its pointer in
// (0x8f32). Then it bumps (0x8f30); if the flip flag (0x8f61) is set it just advances a sub-counter,
// otherwise it seeds 0x8f34=0x20 and enqueues display command 0x0315 (rst 0x38). rst 0x38 = loc_0038.
export function loc_2856(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f50); m.step(0x2859, 13); // 2856  ld a,(0x8f50)
  regs.and(regs.a); m.step(0x285a, 4);
  if (regs.fNZ) {
    m.step(0x2896, 12);
  } else {
    m.step(0x285c, 7);
    regs.ix = 0x8c78; m.step(0x2860, 14);
    regs.de = 0xffe8; m.step(0x2863, 10);
    regs.b = 0x06; m.step(0x2865, 7);
    let found = false;
    for (;;) {
      regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x2868, 19); // 2865  ld a,(ix+0)
      regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x286b, 19); // 2868  or (ix+1)
      if (regs.fZ) { m.step(0x2872, 12); found = true; break; }
      m.step(0x286d, 7);
      regs.addIx(regs.de); m.step(0x286f, 15);
      if (regs.djnz() !== 0) { m.step(0x2865, 13); continue; }
      m.step(0x2871, 8); break;
    }
    if (!found) { m.ret(); return; } // 2871  ret (no free slot)
    mem.write8((regs.ix + 0x01) & 0xffff, 0x05); m.step(0x2876, 19); // 2872  ld (ix+0x01),0x05
    mem.write8((regs.ix + 0x02) & 0xffff, 0x10); m.step(0x287a, 19); // 2876  ld (ix+0x02),0x10
    mem.write8((regs.ix + 0x03) & 0xffff, 0x00); m.step(0x287e, 19); // 287a  ld (ix+0x03),0x00
    mem.write8((regs.ix + 0x04) & 0xffff, 0x08); m.step(0x2882, 19); // 287e  ld (ix+0x04),0x08
    mem.write8((regs.ix + 0x05) & 0xffff, 0x00); m.step(0x2886, 19); // 2882  ld (ix+0x05),0x00
    mem.write8((regs.ix + 0x06) & 0xffff, 0x1a); m.step(0x288a, 19); // 2886  ld (ix+0x06),0x1a
    mem.write8((regs.ix + 0x0f) & 0xffff, 0x37); m.step(0x288e, 19); // 288a  ld (ix+0x0f),0x37
    mem.write8((regs.ix + 0x10) & 0xffff, 0x42); m.step(0x2892, 19); // 288e  ld (ix+0x10),0x42
    mem.write16(0x8f32, regs.ix); m.step(0x2896, 20); // 2892  ld (0x8f32),ix
  }
  regs.hl = 0x8f30; m.step(0x2899, 10);
  regs.incMem8(mem, regs.hl); m.step(0x289a, 11); // 2899  inc (hl)
  regs.a = mem.read8(0x8f61); m.step(0x289d, 13); // 289a  ld a,(0x8f61)
  regs.and(regs.a); m.step(0x289e, 4);
  if (regs.fZ) {
    m.step(0x28a4, 12);
    regs.l = 0x34; m.step(0x28a6, 7); // 28a4  ld l,0x34 -> 0x8f34
    mem.write8(regs.hl, 0x20); m.step(0x28a8, 10); // 28a6  ld (hl),0x20
    regs.de = 0x0315; m.step(0x28ab, 10);
    m.push16(0x28ac); m.step(0x0038, 11); m.call(0x0038);
    m.ret();
    return;
  }
  m.step(0x28a0, 7);
  regs.l = 0x5d; m.step(0x28a2, 7); // 28a0  ld l,0x5d -> 0x8f5d
  regs.incMem8(mem, regs.hl); m.step(0x28a3, 11); // 28a2  inc (hl)
  m.ret();
}
