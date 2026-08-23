// SPDX-License-Identifier: GPL-3.0-only

// loc_1d0d  (ROM 0x1d0d-0x1d12, then shared tail 0x1cec-0x1cf5) -- sprite-slot tail, a mid-routine
// entry of loc_1c66 (reached by fall-through there and by `call z,0x1d0d` at 0x1d20). Writes 0x01
// to 0x8740, then `jr 0x1cec` merges into loc_1ce7's tail (0x25/0x20 down 0x8720 / 0x8700, stride
// -0x20). The shared tail is re-emitted here so this entry reproduces the full ROM effect.
export function loc_1d0d(m) {
  const { regs, mem } = m;

  regs.hl = 0x8740;          m.step(0x1d10, 10);
  mem.write8(regs.hl, 0x01); m.step(0x1d12, 10);
  m.step(0x1cec, 12);        // jr 0x1cec -- into the loc_1ce7 sprite-slot tail

  // shared tail (0x1cec-0x1cf5), re-emitted from loc_1ce7:
  regs.de = 0xffe0;          m.step(0x1cef, 10);
  regs.addHl(regs.de);       m.step(0x1cf0, 11); // -> 0x8720
  mem.write8(regs.hl, 0x25); m.step(0x1cf2, 10);
  regs.addHl(regs.de);       m.step(0x1cf3, 11); // -> 0x8700
  mem.write8(regs.hl, 0x20); m.step(0x1cf5, 10);
  m.ret();
}
