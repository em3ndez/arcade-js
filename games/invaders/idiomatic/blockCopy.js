// SPDX-License-Identifier: GPL-3.0-only

// Copy B bytes from source to destination, both pointers advancing. Live-out: memory only; the seam completes the ret.
export function blockCopy(m, de = m.regs.de, hl = m.regs.hl, b = m.regs.b) {
  const n = b === 0 ? 256 : b;
  for (let i = 0; i < n; i++) {
    m.mem8[hl + i] = m.mem8[de + i];
  }
}
