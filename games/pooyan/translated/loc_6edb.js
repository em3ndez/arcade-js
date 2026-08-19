// SPDX-License-Identifier: GPL-3.0-only

// loc_6edb  (ROM 0x6edb-0x6f2c) -- phase-1 per-record driver. Walks 14 records of the 0x8ae0 table
// (stride 0x18, IX), running loc_6f2d on each; exx parks the loop counter B and stride DE in the
// alternate set across the callee. When the (0x8f4a) script pointer has reached its 0xff terminator
// AND all three 0x8bea slots are idle, it advances the phase (0x8f51), queues display command 0x0635
// (rst 0x38), compares the 3*(0x8f47) tally to (0x8f52) -- on MATCH (equal) it forces phase 4
// (0x8f51:=4) and swaps the queued word to 0x0610; on mismatch it keeps 0x0608 -- then reprimes the
// (0x8f48) delay to 0x40, queues that word, and clears 0x8c90+.
export function loc_6edb(m) {
  const { regs, mem } = m;

  regs.ix = 0x8ae0;
  m.step(0x6edf, 14); // 6edb  ld ix,0x8ae0
  regs.de = 0x0018;
  m.step(0x6ee2, 10); // 6edf  ld de,0x0018
  regs.b = 0x0e;
  m.step(0x6ee4, 7); // 6ee2  ld b,0x0e
  for (;;) {
    regs.exx();
    m.step(0x6ee5, 4); // 6ee4  exx -- park B/DE in the alt set
    m.push16(0x6ee8);
    m.step(0x6f2d, 17); // 6ee5  call 0x6f2d
    m.call(0x6f2d);
    regs.exx();
    m.step(0x6ee9, 4); // 6ee8  exx -- restore B/DE
    regs.addIx(regs.de);
    m.step(0x6eeb, 15); // 6ee9  add ix,de
    if (regs.djnz() !== 0) { m.step(0x6ee4, 13); continue; } // 6eeb  djnz 0x6ee4
    m.step(0x6eed, 8);
    break;
  }

  regs.hl = mem.read16(0x8f4a);
  m.step(0x6ef0, 16); // 6eed  ld hl,(0x8f4a)
  regs.a = mem.read8(regs.hl);
  m.step(0x6ef1, 7); // 6ef0  ld a,(hl)
  regs.cp(0xff);
  m.step(0x6ef3, 7); // 6ef1  cp 0xff
  if (regs.fNZ) { m.ret(11); return; } // 6ef3  ret nz -- script not finished
  m.step(0x6ef4, 5);

  regs.hl = 0x8bea;
  m.step(0x6ef7, 10); // 6ef4  ld hl,0x8bea
  regs.de = 0x0018;
  m.step(0x6efa, 10); // 6ef7  ld de,0x0018
  regs.b = 0x03;
  m.step(0x6efc, 7); // 6efa  ld b,0x03
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x6efd, 7); // 6efc  ld a,(hl)
    regs.and(regs.a);
    m.step(0x6efe, 4); // 6efd  and a
    if (regs.fNZ) { m.ret(11); return; } // 6efe  ret nz -- a slot still busy
    m.step(0x6eff, 5);
    regs.addHl(regs.de);
    m.step(0x6f00, 11); // 6eff  add hl,de
    if (regs.djnz() !== 0) { m.step(0x6efc, 13); continue; } // 6f00  djnz 0x6efc
    m.step(0x6f02, 8);
    break;
  }

  regs.hl = 0x8f51;
  m.step(0x6f05, 10); // 6f02  ld hl,0x8f51
  regs.incMem8(mem, regs.hl);
  m.step(0x6f06, 11); // 6f05  inc (hl) -- advance phase
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6f07, 6); // 6f06  inc hl -> 0x8f52
  regs.de = 0x0635;
  m.step(0x6f0a, 10); // 6f07  ld de,0x0635
  m.push16(0x6f0b);
  m.step(0x0038, 11); // 6f0a  rst 0x38 -- queue display command 0x0635
  m.call(0x0038);
  regs.a = mem.read8(0x8f47);
  m.step(0x6f0e, 13); // 6f0b  ld a,(0x8f47)
  regs.b = regs.a;
  m.step(0x6f0f, 4); // 6f0e  ld b,a
  regs.a = regs.sla(regs.a);
  m.step(0x6f11, 8); // 6f0f  sla a
  regs.add(regs.b);
  m.step(0x6f12, 4); // 6f11  add a,b -- A = 3*(0x8f47)
  regs.cp(mem.read8(regs.hl));
  m.step(0x6f13, 7); // 6f12  cp (hl) -- vs (0x8f52)
  regs.de = 0x0608;
  m.step(0x6f16, 10); // 6f13  ld de,0x0608
  if (regs.fNZ) {
    m.step(0x6f1f, 12); // 6f16  jr nz,0x6f1f
  } else {
    m.step(0x6f18, 7);
    regs.a = 0x04;
    m.step(0x6f1a, 7); // 6f18  ld a,0x04
    mem.write8(0x8f51, regs.a);
    m.step(0x6f1d, 13); // 6f1a  ld (0x8f51),a -- force phase 4
    regs.e = 0x10;
    m.step(0x6f1f, 7); // 6f1d  ld e,0x10 -- DE = 0x0610
  }
  regs.a = 0x40;
  m.step(0x6f21, 7); // 6f1f  ld a,0x40
  mem.write8(0x8f48, regs.a);
  m.step(0x6f24, 13); // 6f21  ld (0x8f48),a
  m.push16(0x6f25);
  m.step(0x0038, 11); // 6f24  rst 0x38 -- queue DE
  m.call(0x0038);
  regs.xor(regs.a);
  m.step(0x6f26, 4); // 6f25  xor a
  regs.hl = 0x8c90;
  m.step(0x6f29, 10); // 6f26  ld hl,0x8c90
  regs.b = 0x30;
  m.step(0x6f2b, 7); // 6f29  ld b,0x30
  m.push16(0x6f2c);
  m.step(0x0010, 11); // 6f2b  rst 0x10 -- fill 0x30 bytes = 0
  m.call(0x0010);
  m.ret(); // 6f2c  ret
}
