// SPDX-License-Identifier: GPL-3.0-only

// loc_0ac8  (ROM 0x0ac8-0x0b25) -- attract sub-state 5 (dispatch target 0x08a1[5]).
// Frame-timer countdown at 0x8d41 (call 0x0a28 on wrap), advances the scripted sprite step at
// 0x09f8, then on the 0x8e50 tick: pull the next byte from the (0x8e54) script pointer, store it
// through the (0x8e56) write pointer and back the write pointer up 0x20 (one row). Every 0x8e52
// ticks it re-seeds the timers and runs a 14-row rolling checksum (stride 0x20) of the placed
// column into DE, verified against the two bytes at the (0x8f48) pointer; a mismatch takes the
// 0x7442/0x76ea tamper jumps. Un-annotated addresses = the previous m.step's nextAddr.
// The 12 bytes at 0x0b26-0x0b31 are a trailing word table (data), not part of this routine.
export function loc_0ac8(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d41;
  m.step(0x0acb, 10); // 0ac8  ld hl,0x8d41
  regs.decMem8(mem, regs.hl);
  m.step(0x0acc, 11); // 0acb  dec (hl)
  if (regs.fNZ) {
    m.step(0x0ad1, 12); // 0acc  jr nz,0x0ad1
  } else {
    m.step(0x0ace, 7);
    m.push16(0x0ad1);
    m.step(0x0a28, 17); // 0ace  call 0x0a28
    m.call(0x0a28);
  }
  m.push16(0x0ad4);
  m.step(0x09f8, 17); // 0ad1  call 0x09f8
  m.call(0x09f8);

  regs.hl = 0x8e50;
  m.step(0x0ad7, 10); // 0ad4  ld hl,0x8e50
  regs.decMem8(mem, regs.hl);
  m.step(0x0ad8, 11); // 0ad7  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 0ad8  ret nz
  m.step(0x0ad9, 5);

  mem.write8(regs.hl, 0x02);
  m.step(0x0adb, 10); // 0ad9  ld (hl),0x02
  regs.hl = mem.read16(0x8e54);
  m.step(0x0ade, 16); // 0adb  ld hl,(0x8e54)
  regs.a = mem.read8(regs.hl);
  m.step(0x0adf, 7); // 0ade  ld a,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0ae0, 6); // 0adf  inc hl
  mem.write16(0x8e54, regs.hl);
  m.step(0x0ae3, 16); // 0ae0  ld (0x8e54),hl
  regs.hl = mem.read16(0x8e56);
  m.step(0x0ae6, 16); // 0ae3  ld hl,(0x8e56)
  mem.write8(regs.hl, regs.a);
  m.step(0x0ae7, 7); // 0ae6  ld (hl),a
  regs.de = 0xffe0;
  m.step(0x0aea, 10); // 0ae7  ld de,0xffe0
  regs.addHl(regs.de);
  m.step(0x0aeb, 11); // 0aea  add hl,de
  mem.write16(0x8e56, regs.hl);
  m.step(0x0aee, 16); // 0aeb  ld (0x8e56),hl
  regs.hl = 0x8e52;
  m.step(0x0af1, 10); // 0aee  ld hl,0x8e52
  regs.decMem8(mem, regs.hl);
  m.step(0x0af2, 11); // 0af1  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 0af2  ret nz
  m.step(0x0af3, 5);

  mem.write8(regs.hl, 0x0d);
  m.step(0x0af5, 10); // 0af3  ld (hl),0x0d
  regs.hl = 0x8e50;
  m.step(0x0af8, 10); // 0af5  ld hl,0x8e50
  mem.write8(regs.hl, 0x14);
  m.step(0x0afa, 10); // 0af8  ld (hl),0x14
  regs.l = regs.inc8(regs.l);
  m.step(0x0afb, 4); // 0afa  inc l
  regs.incMem8(mem, regs.hl);
  m.step(0x0afc, 11); // 0afb  inc (hl)
  regs.hl = mem.read16(0x8e56);
  m.step(0x0aff, 16); // 0afc  ld hl,(0x8e56)
  regs.de = 0x0000;
  m.step(0x0b02, 10); // 0aff  ld de,0x0000
  regs.b = 0x0e;
  m.step(0x0b04, 7); // 0b02  ld b,0x0e

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x0b05, 7); // 0b04  ld a,(hl)
    regs.add(regs.e);
    m.step(0x0b06, 4); // 0b05  add a,e
    regs.e = regs.a;
    m.step(0x0b07, 4); // 0b06  ld e,a
    if (regs.fNC) {
      m.step(0x0b0a, 12); // 0b07  jr nc,0x0b0a
    } else {
      m.step(0x0b09, 7);
      regs.d = regs.inc8(regs.d);
      m.step(0x0b0a, 4); // 0b09  inc d
    }
    regs.a = 0x20;
    m.step(0x0b0c, 7); // 0b0a  ld a,0x20
    regs.add(regs.l);
    m.step(0x0b0d, 4); // 0b0c  add a,l
    regs.l = regs.a;
    m.step(0x0b0e, 4); // 0b0d  ld l,a
    if (regs.fNC) {
      m.step(0x0b11, 12); // 0b0e  jr nc,0x0b11
    } else {
      m.step(0x0b10, 7);
      regs.h = regs.inc8(regs.h);
      m.step(0x0b11, 4); // 0b10  inc h
    }
    if (regs.djnz() !== 0) { m.step(0x0b04, 13); continue; } // 0b11  djnz 0x0b04
    m.step(0x0b13, 8);
    break;
  }

  regs.hl = mem.read16(0x8f48);
  m.step(0x0b16, 16); // 0b13  ld hl,(0x8f48)
  regs.a = mem.read8(regs.hl);
  m.step(0x0b17, 7); // 0b16  ld a,(hl)
  regs.cp(regs.e);
  m.step(0x0b18, 4); // 0b17  cp e
  if (regs.fNZ) {
    m.step(0x7442, 10); // 0b18  jp nz,0x7442 -- checksum-fail tamper trap
    return m.call(0x7442);
  }
  m.step(0x0b1b, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0b1c, 6); // 0b1b  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x0b1d, 7); // 0b1c  ld a,(hl)
  regs.cp(regs.d);
  m.step(0x0b1e, 4); // 0b1d  cp d
  if (regs.fNZ) {
    m.step(0x76ea, 10); // 0b1e  jp nz,0x76ea -- checksum-fail tamper trap
    return m.call(0x76ea);
  }
  m.step(0x0b21, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0b22, 6); // 0b21  inc hl
  mem.write16(0x8f48, regs.hl);
  m.step(0x0b25, 16); // 0b22  ld (0x8f48),hl
  m.ret(); // 0b25  ret
}
