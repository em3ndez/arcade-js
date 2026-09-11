// SPDX-License-Identifier: GPL-3.0-only
// loc_b5d7  (ROM 0xb5d7-0xb5e0) -- RTS-trick computed dispatch: tay, push word($b5e1+Y) then rts, i.e. jump
// to (word $b5e1+Y)+1 (a jump table indexed by Y). The dispatched routine returns to loc_b5d7's own caller.
export function loc_b5d7(m) {
  const { regs, mem } = m;
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb5d8, 2);
  { const a = (0xb5e2 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5db, 4 + ((0xb5e2 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  m.push8(regs.a); m.step(0xb5dc, 3);
  { const a = (0xb5e1 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5df, 4 + ((0xb5e1 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  m.push8(regs.a); m.step(0xb5e0, 3);
  const t = (m.pull16() + 1) & 0xffff; m.step(t, 6); return m.call(t);
}
