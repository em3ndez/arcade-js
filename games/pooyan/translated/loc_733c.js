// SPDX-License-Identifier: GPL-3.0-only

// loc_733c  (ROM 0x733c-0x7394) -- eagle-record state 0 (approach). Returns unless the eagle's grid
// column (0x8c96>>3) matches (ix+6) (or (ix+6)-1) and its row (0x8c94>>3 + 4, with a -5 window) is at
// (ix+4). On a hit it advances the record state ((ix+2)++). Even records (bit3 of IXL clear) queue
// display command 0x4086, set (ix+9)=0x40 and, once every record has arrived ((0x8f39)==(0x8f3d)),
// queue the wave sound 0x0630+(0x8f3d) via rst 0x38; odd records queue 0x7403 and set (ix+9)=0x38.
export function loc_733c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8c96);
  m.step(0x733f, 13); // 733c  ld a,(0x8c96)
  regs.a = regs.srl(regs.a);
  m.step(0x7341, 8); // 733f  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7343, 8); // 7341  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7345, 8); // 7343  srl a
  regs.cp(mem.read8((regs.ix + 0x06) & 0xffff));
  m.step(0x7348, 19); // 7345  cp (ix+0x06)
  if (regs.fZ) {
    m.step(0x734f, 12); // 7348  jr z,0x734f
  } else {
    m.step(0x734a, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x734b, 4); // 734a  inc a
    regs.cp(mem.read8((regs.ix + 0x06) & 0xffff));
    m.step(0x734e, 19); // 734b  cp (ix+0x06)
    if (regs.fNZ) { m.ret(11); return; } // 734e  ret nz
    m.step(0x734f, 5);
  }
  regs.a = mem.read8(0x8c94);
  m.step(0x7352, 13); // 734f  ld a,(0x8c94)
  regs.a = regs.srl(regs.a);
  m.step(0x7354, 8); // 7352  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7356, 8); // 7354  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x7358, 8); // 7356  srl a
  regs.add(0x04);
  m.step(0x735a, 7); // 7358  add a,0x04
  regs.cp(mem.read8((regs.ix + 0x04) & 0xffff));
  m.step(0x735d, 19); // 735a  cp (ix+0x04)
  if (regs.fZ) {
    m.step(0x7366, 12); // 735d  jr z,0x7366
  } else {
    m.step(0x735f, 7);
    if (regs.fC) { m.ret(11); return; } // 735f  ret c
    m.step(0x7360, 5);
    regs.sub(0x05);
    m.step(0x7362, 7); // 7360  sub 0x05
    regs.cp(mem.read8((regs.ix + 0x04) & 0xffff));
    m.step(0x7365, 19); // 7362  cp (ix+0x04)
    if (regs.fNC) { m.ret(11); return; } // 7365  ret nc
    m.step(0x7366, 5);
  }
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x7369, 23); // 7366  inc (ix+0x02) -- advance record state
  regs.a = regs.ix & 0xff;
  m.step(0x736b, 8); // 7369  ld a,ixl
  regs.bit(3, regs.a);
  m.step(0x736d, 8); // 736b  bit 3,a
  if (regs.fNZ) {
    m.step(0x738a, 12); // 736d  jr nz,0x738a -- odd record
    regs.de = 0x7403;
    m.step(0x738d, 10); // 738a  ld de,0x7403
    m.push16(0x7390);
    m.step(0x381e, 17); // 738d  call 0x381e
    m.call(0x381e);
    mem.write8((regs.ix + 0x09) & 0xffff, 0x38);
    m.step(0x7394, 19); // 7390  ld (ix+0x09),0x38
    m.ret(); // 7394  ret
    return;
  }
  m.step(0x736f, 7);
  regs.de = 0x4086;
  m.step(0x7372, 10); // 736f  ld de,0x4086
  m.push16(0x7375);
  m.step(0x381e, 17); // 7372  call 0x381e
  m.call(0x381e);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x40);
  m.step(0x7379, 19); // 7375  ld (ix+0x09),0x40
  regs.hl = 0x8f39;
  m.step(0x737c, 10); // 7379  ld hl,0x8f39
  regs.incMem8(mem, regs.hl);
  m.step(0x737d, 11); // 737c  inc (hl)
  regs.a = mem.read8(0x8f3d);
  m.step(0x7380, 13); // 737d  ld a,(0x8f3d)
  regs.cp(mem.read8(regs.hl));
  m.step(0x7381, 7); // 7380  cp (hl)
  if (regs.fNZ) { m.ret(11); return; } // 7381  ret nz -- not all arrived yet
  m.step(0x7382, 5);
  regs.a = mem.read8(regs.hl);
  m.step(0x7383, 7); // 7382  ld a,(hl)
  regs.de = 0x0630;
  m.step(0x7386, 10); // 7383  ld de,0x0630
  regs.add(regs.e);
  m.step(0x7387, 4); // 7386  add a,e
  regs.e = regs.a;
  m.step(0x7388, 4); // 7387  ld e,a
  m.push16(0x7389);
  m.step(0x0038, 11); // 7388  rst 0x38 -- queue wave sound 0x0630+(0x8f3d)
  m.call(0x0038);
  m.ret(); // 7389  ret
}
