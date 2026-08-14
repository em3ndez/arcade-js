// SPDX-License-Identifier: GPL-3.0-only

// loc_2673  (ROM 0x2673-0x2699) — award-points helper. When (0x8120)==0, seed the floating-score
// entry at 0x805C (B, 0x19, 0x03, 0x20) + (0x8340)=0xA0 and add DE=0x20 to the score via loc_08e0.
// When (0x8120)!=0 the loc_2693 arm sets (0x8004)=1 and pops the caller's return (skips its remainder).
export function loc_2673(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8120);
  m.step(0x2676, 13); // ld a,(0x8120) -- the guard cell
  regs.and(regs.a);
  m.step(0x2677, 4);
  if (regs.fNZ) {
    m.step(0x2693, 10); // jp nz,0x2693
    return b_2693();
  }
  m.step(0x267a, 10);
  regs.hl = 0x805c;
  m.step(0x267d, 10); // ld hl,0x805c
  mem.write8(regs.hl, regs.b);
  m.step(0x267e, 7); // ld (hl),b -- B = the score-popup position
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x267f, 6);
  mem.write8(regs.hl, 0x19);
  m.step(0x2681, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2682, 6);
  mem.write8(regs.hl, 0x03);
  m.step(0x2684, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2685, 6);
  mem.write8(regs.hl, 0x20);
  m.step(0x2687, 10);
  regs.a = 0xa0;
  m.step(0x2689, 7);
  mem.write8(0x8340, regs.a);
  m.step(0x268c, 13); // ld (0x8340),a
  regs.de = 0x0020;
  m.step(0x268f, 10); // ld de,0x0020 -- the score increment
  m.push16(0x2692);
  m.step(0x08e0, 17); // call 0x08e0 -- add DE to the BCD score
  m.call(0x08e0);
  m.ret(); // ret at 0x2692

  function b_2693() {
    regs.a = 0x01;
    m.step(0x2695, 7);
    mem.write8(0x8004, regs.a);
    m.step(0x2698, 13); // ld (0x8004),a
    regs.hl = m.pop16();
    m.step(0x2699, 10); // pop hl -- discard the caller's return, skip its remainder
    m.ret(); // ret to the caller's caller
  }
}
