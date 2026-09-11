// SPDX-License-Identifier: GPL-3.0-only
// loc_9683  (ROM 0x9683-0x968e) -- RTS-dispatch (computed JMP): reads a little-endian pointer from
// the table at $969d (lo) / $969e (hi) indexed by $015e; the pha/pha/rts jumps to pointer+1.
// Idiom pushes NO return for the target -- it tail-calls the handler, which consumes the caller's
// own return on its rts. Seam form: compute target+1, m.step(6) for the rts, then m.call(target+1).
export function loc_9683(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x015e); regs.setNZ(regs.x); m.step(0x9686, 4);
  const hi = mem.read8((0x969e + regs.x) & 0xffff);
  regs.a = hi; regs.setNZ(regs.a); m.step(0x9689, 4);
  m.step(0x968a, 3); // pha (hi)
  const lo = mem.read8((0x969d + regs.x) & 0xffff);
  regs.a = lo; regs.setNZ(regs.a); m.step(0x968d, 4);
  m.step(0x968e, 3); // pha (lo)
  const target = (((hi << 8) | lo) + 1) & 0xffff;
  m.step(target, 6); // rts -> jump to pointer+1
  return m.call(target);
}
