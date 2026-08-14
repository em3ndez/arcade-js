// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_2cf0  (ROM 0x2CF0-0x2D87) — the coin/credit scanner called first by the vblank
// NMI (0x0075). Boot/attract path (0x2CF0-0x2CFE): latch ~IN0 & 0xC4 (the coin+service
// bits) into 0x83E2 and return. On a coin-release edge it credits: two computed
// `jp (hl)` dispatches (0x2D22, 0x2D39) index an interior `jr`-table by the coinage word
// DE=(0x83D4) ∈ {0,2,4,6}, then a shared BCD credit-add at 0x2D57 and a tail-jump to 0x0B67.
export function loc_2cf0(m) {
  const { regs, mem } = m;

  regs.hl = 0x83e2;
  m.step(0x2cf3, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x2cf4, 7);
  regs.or(regs.a);
  m.step(0x2cf5, 4); // or a -- Z := (0x83e2)==0 (survives the reload+cpl below)
  regs.a = mem.read8(0xe000);
  m.step(0x2cf8, 13); // ld a,(0xe000) -- IN0 (no flag effect)
  regs.cpl();
  m.step(0x2cf9, 4); // cpl -- preserves Z
  if (regs.fNZ) {
    m.step(0x2cff, 12); // jr nz,0x2cff -- (0x83e2) was already non-zero
    return block_2cff();
  }
  m.step(0x2cfb, 7);
  regs.and(0xc4);
  m.step(0x2cfd, 7); // and 0xc4 -- coin+service bits of ~IN0
  mem.write8(regs.hl, regs.a);
  m.step(0x2cfe, 7); // ld (hl),a -- (0x83e2) = ~IN0 & 0xC4
  m.ret();

  // ---- coin-release + credit path (guarded by 0x83e2, never taken in attract) ----

  function block_2cff() {
    regs.and(0xc4);
    m.step(0x2d01, 7);
    if (regs.fNZ) {
      m.ret(11); // ret nz -- a coin/service bit is still held
      return;
    }
    m.step(0x2d02, 5);
    regs.a = regs.inc8(regs.a);
    m.step(0x2d03, 4); // inc a -- A was 0 -> 1 (sound command)
    m.push16(0x2d06);
    m.step(0x0794, 17); // call 0x0794 -- issue the coin sound
    m.call(0x0794);
    regs.xor(regs.a);
    m.step(0x2d07, 4); // xor a -- A=0
    regs.de = mem.read16(0x83d4);
    m.step(0x2d0b, 20); // ld de,(0x83d4) -- coinage word
    regs.bit(6, mem.read8(regs.hl));
    m.step(0x2d0d, 12); // bit 6,(hl) -- (0x83e2); F3/F5 from value (no WZ model)
    if (regs.fNZ) {
      m.step(0x2d2b, 10);
      return block_2d2b();
    }
    m.step(0x2d10, 10);
    regs.bit(2, mem.read8(regs.hl));
    m.step(0x2d12, 12); // bit 2,(hl) -- test BEFORE the store clears it
    mem.write8(regs.hl, regs.a);
    m.step(0x2d13, 7); // ld (hl),a -- (0x83e2) = 0 (no flag effect)
    if (regs.fNZ) {
      m.step(0x2d1e, 12);
      return block_2d1e();
    }
    m.step(0x2d15, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x2d16, 4); // inc a -- A=1
    mem.write8(0xb818, regs.a, 10);
    m.step(0x2d19, 13); // ld (0xb818),a -- coin counter
    regs.a = 0x04;
    m.step(0x2d1b, 7);
    mem.write8(0x837e, regs.a);
    m.step(0x2d1e, 13); // ld (0x837e),a -- coin-counter pulse timer
    return block_2d1e();
  }

  function block_2d1e() {
    regs.hl = 0x2d23;
    m.step(0x2d21, 10); // ld hl,0x2d23 -- jr-table base
    regs.addHl(regs.de);
    m.step(0x2d22, 11); // add hl,de -- DE = coinage {0,2,4,6}
    m.step(regs.hl, 4); // jp (hl) -- lands on a `jr` in the 0x2d23 table
    switch (regs.hl) {
      case 0x2d23:
        m.step(0x2d49, 12);
        return block_2d49();
      case 0x2d25:
        m.step(0x2d42, 12);
        return block_2d42();
      case 0x2d27:
        m.step(0x2d42, 12);
        return block_2d42();
      case 0x2d29:
        m.step(0x2d49, 12);
        return block_2d49();
      default:
        throw new NotImplemented(
          `loc_2cf0 jp(hl) at 0x2d22: DE=0x${regs.de.toString(16)} outside coinage table {0,2,4,6}`,
        );
    }
  }

  function block_2d2b() {
    mem.write8(regs.hl, regs.a);
    m.step(0x2d2c, 7); // ld (hl),a -- (0x83e2) = 0 (A=0)
    regs.a = regs.inc8(regs.a);
    m.step(0x2d2d, 4); // inc a -- A=1
    mem.write8(0xb81c, regs.a, 10);
    m.step(0x2d30, 13); // ld (0xb81c),a -- coin counter
    regs.a = 0x04;
    m.step(0x2d32, 7);
    mem.write8(0x837f, regs.a);
    m.step(0x2d35, 13); // ld (0x837f),a -- coin-counter pulse timer
    regs.hl = 0x2d3a;
    m.step(0x2d38, 10); // ld hl,0x2d3a -- second jr-table base
    regs.addHl(regs.de);
    m.step(0x2d39, 11);
    m.step(regs.hl, 4); // jp (hl) -- lands on a `jr` in the 0x2d3a table
    switch (regs.hl) {
      case 0x2d3a:
        m.step(0x2d49, 12);
        return block_2d49();
      case 0x2d3c:
        m.step(0x2d42, 12);
        return block_2d42();
      case 0x2d3e:
        m.step(0x2d51, 12);
        return block_2d51();
      case 0x2d40:
        m.step(0x2d55, 12);
        return block_2d55();
      default:
        throw new NotImplemented(
          `loc_2cf0 jp(hl) at 0x2d39: DE=0x${regs.de.toString(16)} outside coinage table {0,2,4,6}`,
        );
    }
  }

  function block_2d42() {
    regs.hl = 0x83e3;
    m.step(0x2d45, 10);
    regs.incMem8(mem, regs.hl);
    m.step(0x2d46, 11);
    regs.bit(0, mem.read8(regs.hl));
    m.step(0x2d48, 12); // bit 0,(hl) -- every-other-coin gate
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x2d49, 5);
    return block_2d49();
  }

  function block_2d49() {
    regs.c = 0x01;
    m.step(0x2d4b, 7);
    m.step(0x2d57, 12); // jr 0x2d57 -- skips the unreached ld c,0x02 at 0x2d4d
    return block_2d57();
  }

  function block_2d51() {
    regs.c = 0x03;
    m.step(0x2d53, 7);
    m.step(0x2d57, 12);
    return block_2d57();
  }

  function block_2d55() {
    regs.c = 0x06;
    m.step(0x2d57, 7);
    return block_2d57();
  }

  function block_2d57() {
    regs.a = mem.read8(0x83e1);
    m.step(0x2d5a, 13); // ld a,(0x83e1) -- credit count (BCD)
    regs.add(regs.c);
    m.step(0x2d5b, 4);
    regs.daa();
    m.step(0x2d5c, 4);
    if (regs.fNC) {
      m.step(0x2d60, 12);
    } else {
      m.step(0x2d5e, 7);
      regs.a = 0x99;
      m.step(0x2d60, 7); // ld a,0x99 -- clamp credits at 99
    }
    mem.write8(0x83e1, regs.a);
    m.step(0x2d63, 13);
    regs.a = mem.read8(0x83fe);
    m.step(0x2d66, 13);
    regs.or(regs.a);
    m.step(0x2d67, 4);
    if (regs.fNZ) {
      m.ret(11); // ret nz -- already playing
      return;
    }
    m.step(0x2d68, 5);
    regs.a = mem.read8(0x83d6);
    m.step(0x2d6b, 13);
    regs.cp(0x05);
    m.step(0x2d6d, 7);
    if (regs.fZ) {
      m.push16(0x2d70);
      m.step(0x0db9, 17);
      m.call(0x0db9);
    } else {
      m.step(0x2d70, 10);
    }
    regs.a = 0x05;
    m.step(0x2d72, 7);
    mem.write8(0x83d6, regs.a);
    m.step(0x2d75, 13);
    regs.xor(regs.a);
    m.step(0x2d76, 4);
    mem.write8(0x83d8, regs.a);
    m.step(0x2d79, 13);
    regs.hl = 0x8040;
    m.step(0x2d7c, 10);
    regs.de = 0x8041;
    m.step(0x2d7f, 10);
    regs.bc = 0x001f;
    m.step(0x2d82, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x2d83, 7); // ld (hl),b -- seed 0 for the clear
    m.ldirAt(0x2d83, 0x2d85); // ldir -- clear 0x8040-0x805f
    m.step(0x0b67, 10);
    return m.call(0x0b67);
  }
}
