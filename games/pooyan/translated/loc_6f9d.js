// SPDX-License-Identifier: GPL-3.0-only

// loc_6f9d  (ROM 0x6f9d-0x6fec) -- level-intro phase 4. Latches (0x8f47) into the 0x8634 HUD cell,
// replaces it with 5*(0x8f47), zeroes the three cells above 0x8634 (stride -0x20), advances the phase
// (0x8f51) and reprimes the (0x8f48) delay to 0x80. It then runs a 0x44-byte ANTI-TAMPER compare of
// 0x6ac5 against its data copy at 0x6fed: on a full match it runs 0x0f44 and queues display command
// 0x0627 (rst 0x38); on a mismatch it jumps to 0x6fe2 which wipes work RAM from 0x8800 via ldir.
export function loc_6f9d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f47);
  m.step(0x6fa0, 13); // 6f9d  ld a,(0x8f47)
  regs.hl = 0x8634;
  m.step(0x6fa3, 10); // 6fa0  ld hl,0x8634
  mem.write8(regs.hl, regs.a);
  m.step(0x6fa4, 7); // 6fa3  ld (hl),a
  regs.b = regs.a;
  m.step(0x6fa5, 4); // 6fa4  ld b,a
  regs.xor(regs.a);
  m.step(0x6fa6, 4); // 6fa5  xor a
  for (;;) {
    regs.add(0x05);
    m.step(0x6fa8, 7); // 6fa6  add a,0x05
    if (regs.djnz() !== 0) { m.step(0x6fa6, 13); continue; } // 6fa8  djnz 0x6fa6 -> A = 5*(0x8f47)
    m.step(0x6faa, 8);
    break;
  }
  mem.write8(0x8f47, regs.a);
  m.step(0x6fad, 13); // 6faa  ld (0x8f47),a
  regs.de = 0xffe0;
  m.step(0x6fb0, 10); // 6fad  ld de,0xffe0
  regs.b = 0x03;
  m.step(0x6fb2, 7); // 6fb0  ld b,0x03
  for (;;) {
    regs.addHl(regs.de);
    m.step(0x6fb3, 11); // 6fb2  add hl,de
    mem.write8(regs.hl, 0x00);
    m.step(0x6fb5, 10); // 6fb3  ld (hl),0x00
    if (regs.djnz() !== 0) { m.step(0x6fb2, 13); continue; } // 6fb5  djnz 0x6fb2
    m.step(0x6fb7, 8);
    break;
  }
  regs.hl = 0x8f51;
  m.step(0x6fba, 10); // 6fb7  ld hl,0x8f51
  regs.incMem8(mem, regs.hl);
  m.step(0x6fbb, 11); // 6fba  inc (hl) -- advance phase
  regs.l = 0x48;
  m.step(0x6fbd, 7); // 6fbb  ld l,0x48 -> 0x8f48
  mem.write8(regs.hl, 0x80);
  m.step(0x6fbf, 10); // 6fbd  ld (hl),0x80 -- reprime delay

  regs.ix = 0x6ac5;
  m.step(0x6fc3, 14); // 6fbf  ld ix,0x6ac5 -- original bytes
  regs.hl = 0x6fed;
  m.step(0x6fc6, 10); // 6fc3  ld hl,0x6fed -- its data copy
  regs.b = 0x44;
  m.step(0x6fc8, 7); // 6fc6  ld b,0x44
  let mismatch = false;
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x6fcb, 19); // 6fc8  ld a,(ix+0x00)
    regs.cp(mem.read8(regs.hl));
    m.step(0x6fcc, 7); // 6fcb  cp (hl)
    if (regs.fNZ) { m.step(0x6fe2, 12); mismatch = true; break; } // 6fcc  jr nz,0x6fe2 -- tamper
    m.step(0x6fce, 7);
    regs.ix = (regs.ix & 0xff00) | regs.inc8(regs.ix & 0xff);
    m.step(0x6fd0, 8); // 6fce  inc ixl
    regs.a = regs.ix & 0xff;
    m.step(0x6fd2, 8); // 6fd0  ld a,ixl
    regs.and(regs.a);
    m.step(0x6fd3, 4); // 6fd2  and a
    if (regs.fNZ) {
      m.step(0x6fd7, 12); // 6fd3  jr nz,0x6fd7
    } else {
      m.step(0x6fd5, 7);
      regs.ix = ((regs.inc8((regs.ix >> 8) & 0xff) << 8) | (regs.ix & 0xff)) & 0xffff;
      m.step(0x6fd7, 8); // 6fd5  inc ixh -- low byte wrapped
    }
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x6fd8, 6); // 6fd7  inc hl
    if (regs.djnz() !== 0) { m.step(0x6fc8, 13); continue; } // 6fd8  djnz 0x6fc8
    m.step(0x6fda, 8);
    break;
  }
  if (!mismatch) {
    m.push16(0x6fdd);
    m.step(0x0f44, 17); // 6fda  call 0x0f44
    m.call(0x0f44);
    regs.de = 0x0627;
    m.step(0x6fe0, 10); // 6fdd  ld de,0x0627
    m.push16(0x6fe1);
    m.step(0x0038, 11); // 6fe0  rst 0x38 -- queue display command 0x0627
    m.call(0x0038);
    m.ret(); // 6fe1  ret
    return;
  }

  regs.xor(regs.a);
  m.step(0x6fe3, 4); // 6fe2  xor a
  regs.hl = 0x8800;
  m.step(0x6fe6, 10); // 6fe3  ld hl,0x8800
  regs.de = 0x8801;
  m.step(0x6fe9, 10); // 6fe6  ld de,0x8801
  mem.write8(regs.hl, regs.a);
  m.step(0x6fea, 7); // 6fe9  ld (hl),a
  m.ldirAt(0x6fea, 0x6fec); // 6fea  ldir -- propagate 0 across work RAM
  m.ret(); // 6fec  ret
}
