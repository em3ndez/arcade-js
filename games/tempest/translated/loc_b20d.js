// SPDX-License-Identifier: GPL-3.0-only
// loc_b20d  (ROM 0xb20d-0xb217) -- RTS trampoline: push (hi=$b219,x)(lo=$b218,x) then rts dispatches
// to (table16+1) selected by $01 (the table at $b218 holds target-1 values).
export function loc_b20d(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x01); regs.setNZ(regs.x); m.step(0xb20f, 3);
  { const ea = (0xb219 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb212, (0xb219 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  m.push8(regs.a); m.step(0xb213, 3);
  { const ea = (0xb218 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb216, (0xb218 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  m.push8(regs.a); m.step(0xb217, 3);
  const t = (m.pull16() + 1) & 0xffff; m.step(t, 6); return m.call(t);
}
