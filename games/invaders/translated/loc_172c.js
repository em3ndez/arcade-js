// SPDX-License-Identifier: GPL-3.0-only
// loc_172c  (ROM 0x172c-0x173d) -- reads 0x2025 (number of players / mode); if zero it seeds
// B=0xfd and tail-jumps to the sound routine 0x19dc, else B=0x02 and tail-jumps to 0x18fa.
export function loc_172c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2025); m.step(0x172f, 13); // 172c  lda 0x2025
  regs.cp(0x00); m.step(0x1731, 7); // 172f  cpi 0x00
  if (regs.fNZ) { // 1731  jnz 0x1739
    m.step(0x1739, 10);
    regs.b = 0x02; m.step(0x173b, 7); // 1739  mvi b,0x02
    m.step(0x18fa, 10); return m.call(0x18fa); // 173b  jmp 0x18fa
  }
  m.step(0x1734, 10);
  regs.b = 0xfd; m.step(0x1736, 7); // 1734  mvi b,0xfd
  m.step(0x19dc, 10); return m.call(0x19dc); // 1736  jmp 0x19dc
}
