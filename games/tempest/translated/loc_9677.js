// SPDX-License-Identifier: GPL-3.0-only
// loc_9677  (ROM 0x9677-0x9682) -- RTS-dispatch: reads a little-endian pointer from the table at
// $968f (lo) / $9690 (hi) indexed by $015e, then "pha hi; pha lo; rts" is a COMPUTED JMP to (hi:lo)+1.
// It does NOT push a return for the target -- the target's own rts consumes the caller's (loc_92c5)
// pushed return. So tail-call the handler. Handler entry: A = pointer-low byte, N/Z per that low byte.
export function loc_9677(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x015e); regs.setNZ(regs.x); m.step(0x967a, 4);
  const hi = mem.read8((0x9690 + regs.x) & 0xffff); regs.a = hi; regs.setNZ(regs.a); m.step(0x967d, 4);
  m.step(0x967e, 3); // pha hi
  const lo = mem.read8((0x968f + regs.x) & 0xffff); regs.a = lo; regs.setNZ(regs.a); m.step(0x9681, 4);
  m.step(0x9682, 3); // pha lo
  const target = (((hi << 8) | lo) + 1) & 0xffff; // rts -> (hi:lo)+1
  m.step(target, 6); return m.call(target);
}
