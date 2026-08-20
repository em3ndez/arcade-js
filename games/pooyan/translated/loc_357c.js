// SPDX-License-Identifier: GPL-3.0-only

// loc_357c  (ROM 0x357c-0x35c5) -- eagle/arrow target-tile resolver + state step.
// (0x8d79)==0: pick a per-frame table row (0x35c7 via loc_0c45, index (0x8907)&0x0f >>1), then a
// column via rst 0x20 (index (0x8d41)&7) to get the wanted tile in A. (0x8d79)!=0 revives an
// alternate lane: bit2 of (ix+7) chooses the direct-compare re-entry (0x359e) or a second table
// base from (0x8d6f)/(0x8d7b) re-entered at the rst 0x20 (0x3595). Common tail: compare (ix+6)
// against the wanted tile -> exact match tail-jumps loc_3617; below 0x14 rets; otherwise sets the
// (ix+8) latch, picks a script (0x3838/0x3856 per (ix+7) bit1) and tail-jumps loc_381e.
export function loc_357c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d79);   m.step(0x357f, 13);
  regs.and(regs.a);             m.step(0x3580, 4);

  let toL359e = false; // set when we re-enter at 0x359e (skip the rst 0x20 lookup + compare)

  if (regs.fNZ) {
    m.step(0x35b4, 12);         // jr nz,0x35b4
    regs.bit(2, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x35b8, 20);
    if (regs.fZ) {
      m.step(0x35c2, 12);       // jr z,0x35c2
      regs.a = mem.read8((regs.ix + 0x06) & 0xffff);   m.step(0x35c5, 19);
      m.step(0x359e, 12);       // jr 0x359e
      toL359e = true;
    } else {
      m.step(0x35ba, 7);
      regs.hl = mem.read16(0x8d6f); m.step(0x35bd, 16);
      regs.a = mem.read8(0x8d7b);   m.step(0x35c0, 13);
      m.step(0x3595, 12);       // jr 0x3595 -> the rst 0x20 lookup
    }
  } else {
    m.step(0x3582, 7);
    regs.hl = 0x35c7;           m.step(0x3585, 10);
    regs.a = mem.read8(0x8907); m.step(0x3588, 13);
    regs.and(0x0f);             m.step(0x358a, 7);
    regs.a = regs.srl(regs.a);  m.step(0x358c, 8);
    m.push16(0x358f);
    m.step(0x0c45, 17);         // call 0x0c45 -- DE = row[index], HL = base+2*index+1
    m.call(0x0c45);
    regs.exDeHl();              m.step(0x3590, 4);  // HL = row base for rst 0x20
    regs.a = mem.read8(0x8d41); m.step(0x3593, 13);
    regs.and(0x07);             m.step(0x3595, 7);
  }

  if (!toL359e) {
    // 0x3595: rst 0x20 resolves A = row[column]; compare against (ix+6)
    m.push16(0x3596);
    m.step(0x0020, 11);         // rst 0x20
    m.call(0x0020);
    regs.c = regs.a;            m.step(0x3597, 4);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x359a, 19);
    regs.cp(regs.c);            m.step(0x359b, 4);
    if (regs.fZ) { m.step(0x3617, 10); return m.call(0x3617); } // jp z,0x3617 -- exact hit
    m.step(0x359e, 10);
  }

  // 0x359e: below 0x14 -> ret; else latch state and dispatch a script
  regs.cp(0x14);                m.step(0x35a0, 7);
  if (regs.fC) { return m.ret(11); } // ret c
  m.step(0x35a1, 5);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x01); m.step(0x35a5, 19);
  regs.de = 0x3838;             m.step(0x35a8, 10);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x35ac, 20);
  if (regs.fZ) {
    m.step(0x35b1, 12);         // jr z,0x35b1
  } else {
    m.step(0x35ae, 7);
    regs.de = 0x3856;           m.step(0x35b1, 10);
  }
  m.step(0x381e, 10);           // jp 0x381e (tail)
  return m.call(0x381e);
}
