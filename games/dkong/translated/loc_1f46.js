// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f46  (ROM 0x1F46–0x1F71) — PLAYER-STATE RESET (gated on 0x6221).
 * (0x6221)==0 -> ret. Else clear 0x6204/06/21/10-14 (=0), set 0x6216/1f (=1),
 * snapshot Y (0x6205) -> 0x620e. Hands entry_1ac3 a state-1 player next frame.
 * The inc a @ 0x1F64 is the store-value boundary: 8 zeros before, 2 ones after --
 * do not reorder across it.
 */
export function loc_1f46(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6221);
  m.step(0x1f49, 13);
  regs.and(regs.a);
  m.step(0x1f4a, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- nothing to reset
  m.step(0x1f4b, 5);

  regs.xor(regs.a); // A = 0 -- the clear value
  m.step(0x1f4c, 4);
  mem.write8(0x6204, regs.a); m.step(0x1f4f, 13);
  mem.write8(0x6206, regs.a); m.step(0x1f52, 13);
  mem.write8(0x6221, regs.a); m.step(0x1f55, 13); // clear the trigger
  mem.write8(0x6210, regs.a); m.step(0x1f58, 13);
  mem.write8(0x6211, regs.a); m.step(0x1f5b, 13);
  mem.write8(0x6212, regs.a); m.step(0x1f5e, 13);
  mem.write8(0x6213, regs.a); m.step(0x1f61, 13);
  mem.write8(0x6214, regs.a); m.step(0x1f64, 13);
  regs.a = regs.inc8(regs.a); // A = 1 -- the store-value boundary
  m.step(0x1f65, 4);
  mem.write8(0x6216, regs.a); m.step(0x1f68, 13); // state = 1
  mem.write8(0x621f, regs.a); m.step(0x1f6b, 13);
  regs.a = mem.read8(0x6205); // player Y
  m.step(0x1f6e, 13);
  mem.write8(0x620e, regs.a); // snapshot Y
  m.step(0x1f71, 13);
  m.ret(10);
}
