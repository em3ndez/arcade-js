// SPDX-License-Identifier: GPL-3.0-only

// ROM range 0x5a9c-0x5ae3 = two structurally identical coin-counter pulse generators.
// loc_5a9c (called at 0x59fd) drives LS259 latch bit 3 (0xa183) from counters (0x8824)=pulses,
// (0x8825)=phase; loc_5ac0 (reached by `jp 0x5ac0` at 0x5a03) drives bit 4 (0xa184) from
// (0x8826)/(0x8827). Each: if no pulses queued, ret; else on a fresh pulse seed phase=0x30 and
// raise the latch; while counting, drop the latch at phase 0x18 and decrement the pulse count
// once the phase reaches 0. Latch writes are write_d0 (only bit 0 of A lands).

// loc_5a9c -- coin-counter 1 pulse (latch bit 3 @ 0xa183, counters @ 0x8824/0x8825).
export function loc_5a9c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8824);
  m.step(0x5a9f, 13); // 5a9c  ld a,(0x8824) -- queued pulses
  regs.and(regs.a);
  m.step(0x5aa0, 4);
  if (regs.fZ) { m.ret(11); return; } // 5aa0  ret z -- nothing queued
  m.step(0x5aa1, 5);
  regs.hl = 0x8825;
  m.step(0x5aa4, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x5aa5, 7);
  regs.and(regs.a);
  m.step(0x5aa6, 4);
  if (regs.fNZ) {
    m.step(0x5aaf, 12); // 5aa6  jr nz,0x5aaf -- already counting
    regs.decMem8(mem, regs.hl);
    m.step(0x5ab0, 11); // 5aaf  dec (hl) -- advance phase
    if (regs.fZ) {
      m.step(0x5abb, 12); // 5ab0  jr z,0x5abb -- phase hit 0
      regs.hl = 0x8824;
      m.step(0x5abe, 10);
      regs.decMem8(mem, regs.hl);
      m.step(0x5abf, 11); // 5abe  dec (hl) -- one pulse done
      m.ret(); // 5abf  ret
      return;
    }
    m.step(0x5ab2, 7);
    regs.a = mem.read8(regs.hl);
    m.step(0x5ab3, 7);
    regs.cp(0x18);
    m.step(0x5ab5, 7);
    if (regs.fNZ) { m.ret(11); return; } // 5ab5  ret nz -- not at drop point
    m.step(0x5ab6, 5);
    regs.xor(regs.a);
    m.step(0x5ab7, 4);
    mem.write8(0xa183, regs.a);
    m.step(0x5aba, 13); // 5ab7  (0xa183) := 0 -- drop latch
    m.ret(); // 5aba  ret
    return;
  }
  m.step(0x5aa8, 7);
  mem.write8(regs.hl, 0x30);
  m.step(0x5aaa, 10); // 5aa8  (0x8825) := 0x30 -- seed phase
  regs.a = regs.inc8(regs.a);
  m.step(0x5aab, 4); // 5aaa  inc a -- A = 1
  mem.write8(0xa183, regs.a);
  m.step(0x5aae, 13); // 5aab  (0xa183) := 1 -- raise latch
  m.ret(); // 5aae  ret
}

// loc_5ac0 -- coin-counter 2 pulse (latch bit 4 @ 0xa184, counters @ 0x8826/0x8827).
export function loc_5ac0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8826);
  m.step(0x5ac3, 13); // 5ac0  ld a,(0x8826)
  regs.and(regs.a);
  m.step(0x5ac4, 4);
  if (regs.fZ) { m.ret(11); return; } // 5ac4  ret z
  m.step(0x5ac5, 5);
  regs.hl = 0x8827;
  m.step(0x5ac8, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x5ac9, 7);
  regs.and(regs.a);
  m.step(0x5aca, 4);
  if (regs.fNZ) {
    m.step(0x5ad3, 12); // 5aca  jr nz,0x5ad3
    regs.decMem8(mem, regs.hl);
    m.step(0x5ad4, 11); // 5ad3  dec (hl)
    if (regs.fZ) {
      m.step(0x5adf, 12); // 5ad4  jr z,0x5adf
      regs.hl = 0x8826;
      m.step(0x5ae2, 10);
      regs.decMem8(mem, regs.hl);
      m.step(0x5ae3, 11); // 5ae2  dec (hl)
      m.ret(); // 5ae3  ret
      return;
    }
    m.step(0x5ad6, 7);
    regs.a = mem.read8(regs.hl);
    m.step(0x5ad7, 7);
    regs.cp(0x18);
    m.step(0x5ad9, 7);
    if (regs.fNZ) { m.ret(11); return; } // 5ad9  ret nz
    m.step(0x5ada, 5);
    regs.xor(regs.a);
    m.step(0x5adb, 4);
    mem.write8(0xa184, regs.a);
    m.step(0x5ade, 13); // 5adb  (0xa184) := 0
    m.ret(); // 5ade  ret
    return;
  }
  m.step(0x5acc, 7);
  mem.write8(regs.hl, 0x30);
  m.step(0x5ace, 10); // 5acc  (0x8827) := 0x30
  regs.a = regs.inc8(regs.a);
  m.step(0x5acf, 4); // 5ace  inc a
  mem.write8(0xa184, regs.a);
  m.step(0x5ad2, 13); // 5acf  (0xa184) := 1
  m.ret(); // 5ad2  ret
}
