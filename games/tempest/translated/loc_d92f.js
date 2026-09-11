// SPDX-License-Identifier: GPL-3.0-only
// loc_d92f  (ROM 0xd92f-0xd930) -- eor (0x00),y then falls through into loc_d931.
export function loc_d92f(m) {
  const { regs, mem } = m;
  // d92f eor (0x00),y  -- indirect indexed: ptr = [0x00]/[0x01], eff = ptr + y
  const ptr = mem.read8(0x00) | (mem.read8(0x01) << 8);
  const addr = (ptr + regs.y) & 0xffff;
  const cross = (ptr & 0xff00) !== (addr & 0xff00); // +1 on page cross
  regs.eor(mem.read8(addr)); m.step(0xd931, 5 + (cross ? 1 : 0));
  return m.call(0xd931);
}
