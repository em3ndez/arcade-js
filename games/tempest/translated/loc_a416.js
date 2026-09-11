// SPDX-License-Identifier: GPL-3.0-only
// loc_a416  (ROM 0xa416-0xa447) -- if flag $0116==0 rts; else clear it, then for slots x=7..0 with
// $030a,x!=0: advance $0312,x by table a44e[$0302,x]; if it reaches limit a448[type] clear $030a,x else
// re-set $0116; rts.
export function loc_a416(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0116); regs.setNZ(regs.a); m.step(0xa419, 4);
  if (regs.fZ) { m.step(0xa447, 3); return m.ret(6); }
  m.step(0xa41b, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa41d, 2);
  mem.write8(0x0116, regs.a); m.step(0xa420, 4);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa422, 2);
  while (true) {
    regs.a = mem.read8((0x030a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa425, 4);
    if (regs.fZ) { m.step(0xa444, 3); }
    else {
      m.step(0xa427, 2);
      regs.a = mem.read8((0x0312 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa42a, 4);
      regs.y = mem.read8((0x0302 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xa42d, 4);
      regs.clc(); m.step(0xa42e, 2);
      regs.adc(mem.read8((0xa44e + regs.y) & 0xffff)); m.step(0xa431, 4);
      mem.write8((0x0312 + regs.x) & 0xffff, regs.a); m.step(0xa434, 5);
      regs.cmp(mem.read8((0xa448 + regs.y) & 0xffff)); m.step(0xa437, 4);
      if (regs.fNC) {
        m.step(0xa441, 3);
        { const v = (mem.read8(0x0116) + 1) & 0xff; mem.write8(0x0116, v); regs.setNZ(v); } m.step(0xa444, 6);
      } else {
        m.step(0xa439, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa43b, 2);
        mem.write8((0x030a + regs.x) & 0xffff, regs.a); m.step(0xa43e, 5);
        regs.clv(); m.step(0xa43f, 2);
        m.step(0xa444, 3);
      }
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xa445, 2);
    if (!regs.fN) { m.step(0xa422, 3); continue; }
    m.step(0xa447, 2); break;
  }
  return m.ret(6);
}
