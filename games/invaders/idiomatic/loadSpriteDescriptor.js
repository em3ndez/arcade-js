// SPDX-License-Identifier: GPL-3.0-only

// Read the 5-byte descriptor at the pointer into DE, A, C, B, then repoint at C:A. Live-out: registers; the seam completes the ret.
export function loadSpriteDescriptor(m, hl = m.regs.hl) {
  const e = m.mem8[hl];
  const d = m.mem8[hl + 1];
  const a = m.mem8[hl + 2];
  const c = m.mem8[hl + 3];
  const b = m.mem8[hl + 4];
  return [m.regs.hl = (c << 8) | a, m.regs.de = (d << 8) | e, m.regs.a = a, m.regs.b = b, m.regs.c = c];
}
