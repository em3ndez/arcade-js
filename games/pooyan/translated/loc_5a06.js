// SPDX-License-Identifier: GPL-3.0-only

// loc_5a06  (ROM 0x5a06-0x5a1e) -- per-frame score-drip step, variant A.
// Rotates a phase bit of (0x8810) three places into carry, shifts it into the
// ring byte (0x8829) via `rl (hl)`, and when the low 3 bits of that ring hold 1
// fires the drip helper 0x0f09, loads A=1 and joins the shared score-accumulate
// tail at 0x5a8c. Otherwise `ret nz` back to the caller (0x59f4). Off the attract
// path -> boundaries verified against the ROM bytes + disasm agreement.
export function loc_5a06(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8810);
  m.step(0x5a09, 13); // 5a06  ld a,(0x8810)
  regs.rrca();
  m.step(0x5a0a, 4); // 5a09  rrca
  regs.rrca();
  m.step(0x5a0b, 4); // 5a0a  rrca
  regs.rrca();
  m.step(0x5a0c, 4); // 5a0b  rrca
  regs.hl = 0x8829;
  m.step(0x5a0f, 10); // 5a0c  ld hl,0x8829
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x5a11, 15); // 5a0f  rl (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x5a12, 7); // 5a11  ld a,(hl)
  regs.and(0x07);
  m.step(0x5a14, 7); // 5a12  and 0x07
  regs.cp(0x01);
  m.step(0x5a16, 7); // 5a14  cp 0x01
  if (regs.fNZ) {
    m.ret(11); // 5a16  ret nz
    return;
  }
  m.step(0x5a17, 5);
  m.push16(0x5a1a); m.step(0x0f09, 17); m.call(0x0f09); // 5a17  call 0x0f09
  regs.a = 0x01;
  m.step(0x5a1c, 7); // 5a1a  ld a,0x01
  m.step(0x5a8c, 10); // 5a1c  jp 0x5a8c
  return m.call(0x5a8c);
}
