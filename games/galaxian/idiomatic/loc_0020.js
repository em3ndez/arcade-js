// SPDX-License-Identifier: GPL-3.0-only
// Indexed table fetch: add the 8-bit index to the pointer (carrying into the high byte) and read the
// byte there. Returns that byte and leaves the advanced pointer in HL for the caller.

export function loc_0020(m, index = m.regs.a, base = m.regs.hl) {
  const addr = (base + index) % 65536; // pointer advance wraps within 16 bits
  return (m.regs.hl = addr, m.regs.a = m.mem8[addr]);
}
