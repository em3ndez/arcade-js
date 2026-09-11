// SPDX-License-Identifier: GPL-3.0-only
// loc_b84e  (ROM 0xb84e-0xb856) -- RTS-trick computed dispatch: push word($b857+Y) then rts, i.e. jump to
// (word $b857+Y)+1 (a jump table indexed by Y). The dispatched routine returns to loc_b84e's own caller.
export function loc_b84e(m) {
  const { regs, mem } = m;
  { const a = (0xb858 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb851, 4 + ((0xb858 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  m.push8(regs.a); m.step(0xb852, 3);
  { const a = (0xb857 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb855, 4 + ((0xb857 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  m.push8(regs.a); m.step(0xb856, 3);
  const t = (m.pull16() + 1) & 0xffff; m.step(t, 6); return m.call(t);
}
