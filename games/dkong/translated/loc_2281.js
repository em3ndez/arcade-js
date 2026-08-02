// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2281  (ROM 0x2281–0x2289) — loc_2259's Y-descend: Y++ / call 0x3FC0 / Y++.
 *
 * The first `m.step` charge is 0x2284, and that is CORRECT, not a leftover of the old
 * 0x2284 name: `step(nextAddr, cycles)` takes the address of the NEXT instruction, and
 * the entry `ld hl,0x6205` at 0x2281 is 3 bytes. Do not "fix" it to 0x2281 — that pc is
 * what an accepted NMI pushes into diffed work RAM.
 */
export function loc_2281(m) {
  const { regs, mem } = m;
  regs.hl = 0x6205;
  m.step(0x2284, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2285, 11); // Y++
  m.push16(0x2288); m.step(0x3fc0, 17); m.call(0x3fc0);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2289, 11); // Y++
  m.ret(10);
}
