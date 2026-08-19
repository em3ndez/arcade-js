// SPDX-License-Identifier: GPL-3.0-only

// loc_0a52  (ROM 0x0a52-0x0a64) -- paint two 2x2 tile blocks into video RAM via the plain-ret
// copier at 0x0a40, both sourced from the same table at 0x0a72: first anchored at cell 0x82aa,
// then at 0x826a. Called from 0x09d9. The bytes at 0x0a65-0x0ac7 after the ret are that source/
// coordinate DATA table (0x0a72 is read by 0x0a40) -- read from ROM directly, not translated here.
export function loc_0a52(m) {
  const { regs } = m;

  regs.hl = 0x82aa; m.step(0x0a55, 10); // 0a52  ld hl,0x82aa
  regs.de = 0x0a72; m.step(0x0a58, 10); // 0a55  ld de,0x0a72 (source table)
  m.push16(0x0a5b); m.step(0x0a40, 17); m.call(0x0a40); // 0a58  call 0x0a40 -- pattern A
  regs.hl = 0x826a; m.step(0x0a5e, 10); // 0a5b  ld hl,0x826a
  regs.de = 0x0a72; m.step(0x0a61, 10); // 0a5e  ld de,0x0a72
  m.push16(0x0a64); m.step(0x0a40, 17); m.call(0x0a40); // 0a61  call 0x0a40 -- pattern A
  m.ret(); // 0a64  ret
}
