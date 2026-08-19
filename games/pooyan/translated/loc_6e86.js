// SPDX-License-Identifier: GPL-3.0-only

// loc_6e86  (ROM 0x6e86-0x6eda) -- scripted single-object launcher. A (0x8f48) delay ticks down each
// call; on expiry it reloads it from (0x8f49) bit1 (0x20 or 0x2c), then pulls the next byte B from the
// (0x8f4a) script pointer (0xff terminates -> ret). B selects a record in the 0x8ac8 table (stride
// 0x18 -> IX). It scans three 0x8bea records (stride 0x18) for a free slot ((hl)==0); if one is free
// it arms IX record state 6, queues display command 0x396a (0x381e), runs 0x3a6c and bumps (0x8f49);
// if none is free it backs the (0x8f4a) pointer up one and returns to retry next frame.
export function loc_6e86(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f48;
  m.step(0x6e89, 10); // 6e86  ld hl,0x8f48
  regs.a = mem.read8(regs.hl);
  m.step(0x6e8a, 7); // 6e89  ld a,(hl)
  regs.and(regs.a);
  m.step(0x6e8b, 4); // 6e8a  and a
  if (regs.fZ) {
    m.step(0x6e8f, 12); // 6e8b  jr z,0x6e8f -- delay elapsed
  } else {
    m.step(0x6e8d, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x6e8e, 11); // 6e8d  dec (hl)
    m.ret(); // 6e8e  ret
    return;
  }

  regs.a = mem.read8(0x8f49);
  m.step(0x6e92, 13); // 6e8f  ld a,(0x8f49)
  regs.bit(1, regs.a);
  m.step(0x6e94, 8); // 6e92  bit 1,a
  regs.a = 0x20;
  m.step(0x6e96, 7); // 6e94  ld a,0x20
  if (regs.fZ) {
    m.step(0x6e9a, 12); // 6e96  jr z,0x6e9a
  } else {
    m.step(0x6e98, 7);
    regs.a = 0x2c;
    m.step(0x6e9a, 7); // 6e98  ld a,0x2c
  }
  mem.write8(regs.hl, regs.a);
  m.step(0x6e9b, 7); // 6e9a  ld (hl),a -- reload (0x8f48) delay
  regs.hl = mem.read16(0x8f4a);
  m.step(0x6e9e, 16); // 6e9b  ld hl,(0x8f4a)
  regs.a = mem.read8(regs.hl);
  m.step(0x6e9f, 7); // 6e9e  ld a,(hl)
  regs.cp(0xff);
  m.step(0x6ea1, 7); // 6e9f  cp 0xff
  if (regs.fZ) { m.ret(11); return; } // 6ea1  ret z -- script terminator
  m.step(0x6ea2, 5);

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6ea3, 6); // 6ea2  inc hl
  mem.write16(0x8f4a, regs.hl);
  m.step(0x6ea6, 16); // 6ea3  ld (0x8f4a),hl
  regs.b = regs.a;
  m.step(0x6ea7, 4); // 6ea6  ld b,a
  regs.ix = 0x8ac8;
  m.step(0x6eab, 14); // 6ea7  ld ix,0x8ac8
  regs.de = 0x0018;
  m.step(0x6eae, 10); // 6eab  ld de,0x0018
  for (;;) {
    regs.addIx(regs.de);
    m.step(0x6eb0, 15); // 6eae  add ix,de
    if (regs.djnz() !== 0) { m.step(0x6eae, 13); continue; } // 6eb0  djnz 0x6eae
    m.step(0x6eb2, 8);
    break;
  }

  regs.hl = 0x8bea;
  m.step(0x6eb5, 10); // 6eb2  ld hl,0x8bea
  regs.de = 0x0018;
  m.step(0x6eb8, 10); // 6eb5  ld de,0x0018
  regs.b = 0x03;
  m.step(0x6eba, 7); // 6eb8  ld b,0x03
  let free = false;
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x6ebb, 7); // 6eba  ld a,(hl)
    regs.and(regs.a);
    m.step(0x6ebc, 4); // 6ebb  and a
    if (regs.fZ) { m.step(0x6ec9, 12); free = true; break; } // 6ebc  jr z,0x6ec9 -- free slot
    m.step(0x6ebe, 7);
    regs.addHl(regs.de);
    m.step(0x6ebf, 11); // 6ebe  add hl,de
    if (regs.djnz() !== 0) { m.step(0x6eba, 13); continue; } // 6ebf  djnz 0x6eba
    m.step(0x6ec1, 8);
    break;
  }
  if (!free) {
    regs.hl = mem.read16(0x8f4a);
    m.step(0x6ec4, 16); // 6ec1  ld hl,(0x8f4a)
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x6ec5, 6); // 6ec4  dec hl
    mem.write16(0x8f4a, regs.hl);
    m.step(0x6ec8, 16); // 6ec5  ld (0x8f4a),hl -- back up: retry next frame
    m.ret(); // 6ec8  ret
    return;
  }

  mem.write8((regs.ix + 0x02) & 0xffff, 0x06);
  m.step(0x6ecd, 19); // 6ec9  ld (ix+0x02),0x06
  regs.de = 0x396a;
  m.step(0x6ed0, 10); // 6ecd  ld de,0x396a
  m.push16(0x6ed3);
  m.step(0x381e, 17); // 6ed0  call 0x381e -- queue display command
  m.call(0x381e);
  m.push16(0x6ed6);
  m.step(0x3a6c, 17); // 6ed3  call 0x3a6c
  m.call(0x3a6c);
  regs.hl = 0x8f49;
  m.step(0x6ed9, 10); // 6ed6  ld hl,0x8f49
  regs.incMem8(mem, regs.hl);
  m.step(0x6eda, 11); // 6ed9  inc (hl)
  m.ret(); // 6eda  ret
}
