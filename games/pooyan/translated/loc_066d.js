// SPDX-License-Identifier: GPL-3.0-only

// Table read by the rst-0x28 trampoline (loc_0028) at 0x06f0 -- selector = (0x8805):
//   0->0x072d  1->0x0899  2->0x0c4e  3->0x159b  4->0x0e53. The chosen handler ret's to 0x06fa.
const DISPATCH_TABLE_06F0 = "0x06f0 (NMI main-state, selector 0x8805): 072d 0899 0c4e 159b 0e53";

// loc_066d  (ROM 0x066d-0x0713) -- the vblank NMI service routine.
// Saves the full register file (main + shadow + IX/IY), masks NMI (LS259 b0 <- 0), rebuilds the
// scrolling tile columns via loc_0714, samples the three input ports (inverted, active-low) into the
// 0x8810-0x8812 edge-detect ring, ticks two frame counters, then dispatches on the main game state
// (0x8805) through rst 0x28. The dispatched handler returns to 0x06fa, where the epilogue restores
// every register, re-arms NMI (LS259 b0 <- 1), and ret's to the interrupted PC.
export function loc_066d(m) {
  const { regs, mem } = m;

  m.push16(regs.af); m.step(0x066e, 11); // 066d  push af
  m.push16(regs.bc); m.step(0x066f, 11);
  m.push16(regs.de); m.step(0x0670, 11);
  m.push16(regs.hl); m.step(0x0671, 11);
  regs.exAf(); m.step(0x0672, 4); // 0671  ex af,af'
  regs.exx(); m.step(0x0673, 4);
  m.push16(regs.af); m.step(0x0674, 11);
  m.push16(regs.bc); m.step(0x0675, 11);
  m.push16(regs.de); m.step(0x0676, 11);
  m.push16(regs.hl); m.step(0x0677, 11);
  m.push16(regs.ix); m.step(0x0679, 15); // 0677  push ix
  m.push16(regs.iy); m.step(0x067b, 15); // 0679  push iy
  regs.xor(regs.a); m.step(0x067c, 4);
  mem.write8(0xa180, regs.a); m.step(0x067f, 13); // 067c  LS259 b0 <- 0 (NMI disable)
  regs.hl = 0x8840; m.step(0x0682, 10);
  regs.ix = 0x9410; m.step(0x0686, 14);
  regs.de = 0x9010; m.step(0x0689, 10);
  regs.b = 0x04; m.step(0x068b, 7);
  regs.a = mem.read8(0x880a); m.step(0x068e, 13);
  regs.cp(0x04); m.step(0x0690, 7);
  if (regs.fZ) {
    m.step(0x0696, 12); // 0690  jr z,0x0696 -- state 4: draw four column groups
    m.push16(0x0699); m.step(0x0714, 17); m.call(0x0714);
    regs.hl = 0x887c; m.step(0x069c, 10);
    regs.b = 0x03; m.step(0x069e, 7);
    m.push16(0x06a1); m.step(0x0714, 17); m.call(0x0714);
    regs.hl = 0x8850; m.step(0x06a4, 10);
    regs.b = 0x0b; m.step(0x06a6, 7);
    m.push16(0x06a9); m.step(0x0714, 17); m.call(0x0714);
    regs.hl = 0x8888; m.step(0x06ac, 10);
    regs.b = 0x06; m.step(0x06ae, 7);
  } else {
    m.step(0x0692, 7); // 0690  jr z not taken -- other states: one 0x18-tall column group
    regs.b = 0x18; m.step(0x0694, 7);
    m.step(0x06ae, 12); // 0694  jr 0x06ae
  }
  m.push16(0x06b1); m.step(0x0714, 17); m.call(0x0714); // 06ae  call 0x0714 (converged)

  mem.write8(0xa000, regs.a); m.step(0x06b4, 13); // 06b1  watchdog kick
  regs.a = mem.read8(0x8815); m.step(0x06b7, 13);
  mem.write8(0x8816, regs.a); m.step(0x06ba, 13);
  regs.a = mem.read8(0x8813); m.step(0x06bd, 13);
  mem.write8(0x8815, regs.a); m.step(0x06c0, 13);
  regs.hl = mem.read16(0x8810); m.step(0x06c3, 16); // 06c0  ld hl,(0x8810)
  mem.write16(0x8813, regs.hl); m.step(0x06c6, 16);
  regs.hl = 0x8812; m.step(0x06c9, 10);
  regs.a = mem.read8(0xa0c0); m.step(0x06cc, 13); // IN2
  regs.cpl(); m.step(0x06cd, 4);
  mem.write8(regs.hl, regs.a); m.step(0x06ce, 7);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x06cf, 6);
  regs.a = mem.read8(0xa0a0); m.step(0x06d2, 13); // IN1
  regs.cpl(); m.step(0x06d3, 4);
  mem.write8(regs.hl, regs.a); m.step(0x06d4, 7);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x06d5, 6);
  regs.a = mem.read8(0xa080); m.step(0x06d8, 13); // IN0
  regs.cpl(); m.step(0x06d9, 4);
  mem.write8(regs.hl, regs.a); m.step(0x06da, 7);
  regs.hl = 0x883f; m.step(0x06dd, 10);
  regs.decMem8(mem, regs.hl); m.step(0x06de, 11); // 06dd  dec (0x883f)
  regs.hl = 0x8a5f; m.step(0x06e1, 10);
  regs.decMem8(mem, regs.hl); m.step(0x06e2, 11); // 06e1  dec (0x8a5f)
  m.push16(0x06e5); m.step(0x59e8, 17); m.call(0x59e8);
  m.push16(0x06e8); m.step(0x0e64, 17); m.call(0x0e64);
  regs.hl = 0x06fa; m.step(0x06eb, 10);
  m.push16(regs.hl); m.step(0x06ec, 11); // 06eb  push hl -- handler ret's here
  regs.a = mem.read8(0x8805); m.step(0x06ef, 13);
  m.push16(0x06f0); m.step(0x0028, 11); m.call(0x0028, DISPATCH_TABLE_06F0); // 06ef  rst 0x28

  // epilogue at 0x06fa (reached when the dispatched handler ret's here)
  regs.a = mem.read8(0x881f); m.step(0x06fd, 13); // 06fa  ld a,(0x881f)
  mem.write8(0xa187, regs.a); m.step(0x0700, 13); // 06fd  LS259 b7 (flipscreen, inverted)
  regs.iy = m.pop16(); m.step(0x0702, 14); // 0700  pop iy
  regs.ix = m.pop16(); m.step(0x0704, 14); // 0702  pop ix
  regs.hl = m.pop16(); m.step(0x0705, 10);
  regs.de = m.pop16(); m.step(0x0706, 10);
  regs.bc = m.pop16(); m.step(0x0707, 10);
  regs.af = m.pop16(); m.step(0x0708, 10);
  regs.exx(); m.step(0x0709, 4); // 0708  exx
  regs.exAf(); m.step(0x070a, 4); // 0709  ex af,af'
  regs.hl = m.pop16(); m.step(0x070b, 10);
  regs.de = m.pop16(); m.step(0x070c, 10);
  regs.bc = m.pop16(); m.step(0x070d, 10);
  regs.a = 0x01; m.step(0x070f, 7);
  mem.write8(0xa180, regs.a); m.step(0x0712, 13); // 070f  LS259 b0 <- 1 (NMI re-arm)
  regs.af = m.pop16(); m.step(0x0713, 10);
  m.ret(); // 0713  ret -- back to the interrupted PC
}
