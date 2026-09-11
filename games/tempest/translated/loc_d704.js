// SPDX-License-Identifier: GPL-3.0-only
// loc_d704  (ROM 0xd704-0xd7dc) -- the IRQ handler: saves A/X/Y, checks the stack-depth guard
// (tsx/cpx #0xd0) and the $53 sign; on either failure BRK+jmp -> reinit at loc_d93f. Otherwise
// hits the watchdog ($5000), advances the frame counter ($50/$52 from $60c8), folds the
// coin/switch bits into $4c-$4f, drives the LED/output latch ($4000), picks a table entry at
// $d7dd,x by game state, XORs bits into $a1/$60e0, calls loc_cf24 + loc_cd0a, ticks the
// timers ($53/$07 and the $0406.. / $0409.. cascades), pulses $5800/$4800 if $0c00 bit6 set,
// restores A/X/Y and rti.
export function loc_d704(m) {
  const { regs, mem } = m;
  m.push8(regs.a); m.step(0xd705, 3);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xd706, 2);
  m.push8(regs.a); m.step(0xd707, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd708, 2);
  m.push8(regs.a); m.step(0xd709, 3);
  regs.cld(); m.step(0xd70a, 2);
  regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd70b, 2);
  regs.cpx(0xd0); m.step(0xd70d, 2);
  let panic = false;
  if (regs.fNC) { m.step(0xd713, 3); panic = true; }
  else {
    m.step(0xd70f, 2);
    regs.a = mem.read8(0x53); regs.setNZ(regs.a); m.step(0xd711, 3);
    if (regs.fN) { m.step(0xd713, 2); panic = true; }
    else { m.step(0xd717, 3); }
  }
  if (panic) {
    // d713 BRK + d714 jmp 0xd93f -- panic/watchdog: brk pushes PC+2 and P (B set), sets I;
    // the source's explicit jmp reinits at loc_d93f. brk vector not statically resolvable.
    m.push16(0xd715); m.push8(regs.p); regs.sei(); m.step(0xd714, 7);
    m.step(0xd93f, 3); return m.call(0xd93f);
  }
  // d717 main path (A = mem[0x53] from d70f)
  mem.write8(0x5000, regs.a); m.step(0xd71a, 4);
  mem.write8(0x60cb, regs.a); m.step(0xd71d, 4);
  regs.a = mem.read8(0x60c8); regs.setNZ(regs.a); m.step(0xd720, 4);
  regs.eor(0x0f); m.step(0xd722, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd723, 2);
  regs.and(0x10); m.step(0xd725, 2);
  mem.write8(0x0117, regs.a); m.step(0xd728, 4);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd729, 2);
  regs.sec(); m.step(0xd72a, 2);
  regs.sbc(mem.read8(0x52)); m.step(0xd72c, 3);
  regs.and(0x0f); m.step(0xd72e, 2);
  regs.cmp(0x08); m.step(0xd730, 2);
  if (regs.fC) {
    m.step(0xd732, 2);
    regs.ora(0xf0); m.step(0xd734, 2);
  } else { m.step(0xd734, 3); }
  regs.clc(); m.step(0xd735, 2);
  regs.adc(mem.read8(0x50)); m.step(0xd737, 3);
  mem.write8(0x50, regs.a); m.step(0xd739, 3);
  mem.write8(0x52, regs.y); m.step(0xd73b, 3);
  mem.write8(0x60db, regs.a); m.step(0xd73e, 4);
  regs.y = mem.read8(0x60d8); regs.setNZ(regs.y); m.step(0xd741, 4);
  regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0xd744, 4);
  mem.write8(0x08, regs.a); m.step(0xd746, 3);
  regs.a = mem.read8(0x4c); regs.setNZ(regs.a); m.step(0xd748, 3);
  mem.write8(0x4c, regs.y); m.step(0xd74a, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd74b, 2);
  regs.and(mem.read8(0x4c)); m.step(0xd74d, 3);
  regs.ora(mem.read8(0x4d)); m.step(0xd74f, 3);
  mem.write8(0x4d, regs.a); m.step(0xd751, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd752, 2);
  regs.ora(mem.read8(0x4c)); m.step(0xd754, 3);
  regs.and(mem.read8(0x4d)); m.step(0xd756, 3);
  mem.write8(0x4d, regs.a); m.step(0xd758, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd759, 2);
  regs.eor(mem.read8(0x4f)); m.step(0xd75b, 3);
  regs.and(mem.read8(0x4d)); m.step(0xd75d, 3);
  regs.ora(mem.read8(0x4e)); m.step(0xd75f, 3);
  mem.write8(0x4e, regs.a); m.step(0xd761, 3);
  mem.write8(0x4f, regs.y); m.step(0xd763, 3);
  regs.a = mem.read8(0xb4); regs.setNZ(regs.a); m.step(0xd765, 3);
  regs.y = mem.read8(0x13); regs.setNZ(regs.y); m.step(0xd767, 3);
  if (regs.fN) {
    m.step(0xd769, 2);
    regs.ora(0x04); m.step(0xd76b, 2);
  } else { m.step(0xd76b, 3); }
  regs.y = mem.read8(0x14); regs.setNZ(regs.y); m.step(0xd76d, 3);
  if (regs.fN) {
    m.step(0xd76f, 2);
    regs.ora(0x02); m.step(0xd771, 2);
  } else { m.step(0xd771, 3); }
  regs.y = mem.read8(0x15); regs.setNZ(regs.y); m.step(0xd773, 3);
  if (regs.fN) {
    m.step(0xd775, 2);
    regs.ora(0x01); m.step(0xd777, 2);
  } else { m.step(0xd777, 3); }
  mem.write8(0x4000, regs.a); m.step(0xd77a, 4);
  regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xd77c, 3);
  regs.x = regs.inc8(regs.x); m.step(0xd77d, 2);
  regs.y = mem.read8(0x05); regs.setNZ(regs.y); m.step(0xd77f, 3);
  if (regs.fNZ) { m.step(0xd791, 3); }
  else {
    m.step(0xd781, 2);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xd783, 2);
    regs.y = mem.read8(0x07); regs.setNZ(regs.y); m.step(0xd785, 3);
    regs.cpy(0x40); m.step(0xd787, 2);
    if (regs.fNC) { m.step(0xd791, 3); }
    else {
      m.step(0xd789, 2);
      regs.x = mem.read8(0x06); regs.setNZ(regs.x); m.step(0xd78b, 3);
      regs.cpx(0x02); m.step(0xd78d, 2);
      if (regs.fNC) { m.step(0xd791, 3); }
      else {
        m.step(0xd78f, 2);
        regs.x = 0x03; regs.setNZ(regs.x); m.step(0xd791, 2);
      }
    }
  }
  regs.a = mem.read8((0xd7dd + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xd794, 4);
  regs.eor(mem.read8(0xa1)); m.step(0xd796, 3);
  regs.and(0x03); m.step(0xd798, 2);
  regs.eor(mem.read8(0xa1)); m.step(0xd79a, 3);
  mem.write8(0xa1, regs.a); m.step(0xd79c, 3);
  mem.write8(0x60e0, regs.a); m.step(0xd79f, 4);
  m.push16(0xd7a1); m.step(0xd7a2, 6); m.call(0xcf24);
  m.push16(0xd7a4); m.step(0xd7a5, 6); m.call(0xcd0a);
  mem.write8(0x53, regs.inc8(mem.read8(0x53))); m.step(0xd7a7, 5);
  mem.write8(0x07, regs.inc8(mem.read8(0x07))); m.step(0xd7a9, 5);
  if (regs.fNZ) { m.step(0xd7c9, 3); }
  else {
    m.step(0xd7ab, 2);
    mem.write8(0x0406, regs.inc8(mem.read8(0x0406))); m.step(0xd7ae, 6);
    if (regs.fNZ) { m.step(0xd7b8, 3); }
    else {
      m.step(0xd7b0, 2);
      mem.write8(0x0407, regs.inc8(mem.read8(0x0407))); m.step(0xd7b3, 6);
      if (regs.fNZ) { m.step(0xd7b8, 3); }
      else {
        m.step(0xd7b5, 2);
        mem.write8(0x0408, regs.inc8(mem.read8(0x0408))); m.step(0xd7b8, 6);
      }
    }
    regs.bit(mem.read8(0x05)); m.step(0xd7ba, 3);
    if (regs.fNV) { m.step(0xd7c9, 3); }
    else {
      m.step(0xd7bc, 2);
      mem.write8(0x0409, regs.inc8(mem.read8(0x0409))); m.step(0xd7bf, 6);
      if (regs.fNZ) { m.step(0xd7c9, 3); }
      else {
        m.step(0xd7c1, 2);
        mem.write8(0x040a, regs.inc8(mem.read8(0x040a))); m.step(0xd7c4, 6);
        if (regs.fNZ) { m.step(0xd7c9, 3); }
        else {
          m.step(0xd7c6, 2);
          mem.write8(0x040b, regs.inc8(mem.read8(0x040b))); m.step(0xd7c9, 6);
        }
      }
    }
  }
  regs.bit(mem.read8(0x0c00)); m.step(0xd7cc, 4);
  if (regs.fNV) { m.step(0xd7d7, 3); }
  else {
    m.step(0xd7ce, 2);
    mem.write8(0x0133, regs.inc8(mem.read8(0x0133))); m.step(0xd7d1, 6);
    mem.write8(0x5800, regs.a); m.step(0xd7d4, 4);
    mem.write8(0x4800, regs.a); m.step(0xd7d7, 4);
  }
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xd7d8, 4);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd7d9, 2);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xd7da, 4);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd7db, 2);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xd7dc, 4);
  return m.rti();
}
