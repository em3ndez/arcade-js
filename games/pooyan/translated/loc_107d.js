// SPDX-License-Identifier: GPL-3.0-only

// loc_107d  (ROM 0x107d-0x108f) -- main-loop sub-state handler. Gated on (0x8901): if that flag
// is non-zero it returns immediately (ret nz). Otherwise it advances the sub-state selector at
// 0x8f5c (inc (hl)), enqueues display command DE=0x0635 via rst 0x38 (loc_0038), then seeds the
// countdown at 0x8f62 with 0x40 and returns.
export function loc_107d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8901);
  m.step(0x1080, 13); // 107d  ld a,(0x8901)
  regs.and(regs.a);
  m.step(0x1081, 4); // 1080  and a

  if (regs.fNZ) {
    m.ret(11); // 1081  ret nz taken -- (0x8901) set, bail
    return;
  }
  m.step(0x1082, 5); // 1081  ret nz not taken

  regs.hl = 0x8f5c;
  m.step(0x1085, 10); // 1082  ld hl,0x8f5c
  regs.incMem8(mem, regs.hl);
  m.step(0x1086, 11); // 1085  inc (hl) -- advance sub-state selector
  regs.de = 0x0635;
  m.step(0x1089, 10); // 1086  ld de,0x0635

  m.push16(0x108a);
  m.step(0x0038, 11); // 1089  rst 0x38 -> loc_0038 enqueue (pattern A: rets to 0x108a)
  m.call(0x0038);

  regs.a = 0x40;
  m.step(0x108c, 7); // 108a  ld a,0x40
  mem.write8(0x8f62, regs.a);
  m.step(0x108f, 13); // 108c  ld (0x8f62),a -- seed countdown

  m.ret(); // 108f  ret
}
