// SPDX-License-Identifier: GPL-3.0-only

// loc_6bb2  (ROM 0x6bb2-0x6bed) -- frame-gated bird-column commit. Decrements the countdown at
// 0x8d5e and returns early (ret nz) until it underflows to 0. On the tick it reaches 0, it walks
// the 11-entry record table at 0x8d80 (stride 3: [ptr_lo, active, value]); for each ACTIVE record
// (byte+1 != 0) it stores `value` (byte+2) into RAM at (0x8d80+2*0x0003 + record.ptr) -- i.e.
// hl = active<<8 | ptr, then hl += de + de (de=3) so hl += 6, then (hl) = value. After the scan it
// sets (0x880a)=4 and enqueues five display commands 0x06ab..0x06af via rst 0x38 (loc_0038); the
// fifth de load falls into the tail jr 0x6bae, whose own rst 0x38 flushes 0x06af then jp 0x02ef.
const RST38_ENQUEUE = "loc_0038 rst-0x38 display-command enqueue (pattern A: rets to next)";
const TAIL_6BAE = "0x6bae tail: rst 0x38 (de=0x06af) then jp 0x02ef";

export function loc_6bb2(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d5e;
  m.step(0x6bb5, 10); // 6bb2  ld hl,0x8d5e
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x6bb6, 11); // 6bb5  dec (hl)
  if (regs.fNZ) {
    m.ret(11); // 6bb6  ret nz taken -- countdown still running
    return;
  }
  m.step(0x6bb7, 5); // 6bb6  ret nz not taken

  regs.iy = 0x8d80;
  m.step(0x6bbb, 14); // 6bb7  ld iy,0x8d80
  regs.de = 0x0003;
  m.step(0x6bbe, 10); // 6bbb  ld de,0x0003
  regs.b = 0x0b;
  m.step(0x6bc0, 7); // 6bbe  ld b,0x0b

  for (;;) {
    // loc_6bc0
    regs.xor(regs.a);
    m.step(0x6bc1, 4); // 6bc0  xor a
    regs.h = mem.read8((regs.iy + 1) & 0xffff);
    m.step(0x6bc4, 19); // 6bc1  ld h,(iy+0x01)
    regs.or(regs.h);
    m.step(0x6bc5, 4); // 6bc4  or h

    if (regs.fZ) {
      m.step(0x6bd0, 12); // 6bc5  jr z,0x6bd0 -- inactive record, skip the store
    } else {
      m.step(0x6bc7, 7); // 6bc5  jr z not taken
      regs.l = mem.read8(regs.iy);
      m.step(0x6bca, 19); // 6bc7  ld l,(iy+0x00)
      regs.a = mem.read8((regs.iy + 2) & 0xffff);
      m.step(0x6bcd, 19); // 6bca  ld a,(iy+0x02)
      regs.addHl(regs.de);
      m.step(0x6bce, 11); // 6bcd  add hl,de
      regs.addHl(regs.de);
      m.step(0x6bcf, 11); // 6bce  add hl,de
      mem.write8(regs.hl, regs.a);
      m.step(0x6bd0, 7); // 6bcf  ld (hl),a
    }

    // loc_6bd0
    regs.addIy(regs.de);
    m.step(0x6bd2, 15); // 6bd0  add iy,de
    if (regs.djnz() !== 0) {
      m.step(0x6bc0, 13); // 6bd2  djnz 0x6bc0 taken
      continue;
    }
    m.step(0x6bd4, 8); // 6bd2  djnz not taken
    break;
  }

  regs.a = 0x04;
  m.step(0x6bd6, 7); // 6bd4  ld a,0x04
  mem.write8(0x880a, regs.a);
  m.step(0x6bd9, 13); // 6bd6  ld (0x880a),a

  regs.de = 0x06ab;
  m.step(0x6bdc, 10); // 6bd9  ld de,0x06ab
  m.push16(0x6bdd);
  m.step(0x0038, 11); // 6bdc  rst 0x38 (rets to 0x6bdd)
  m.call(0x0038, RST38_ENQUEUE);

  regs.de = 0x06ac;
  m.step(0x6be0, 10); // 6bdd  ld de,0x06ac
  m.push16(0x6be1);
  m.step(0x0038, 11); // 6be0  rst 0x38 (rets to 0x6be1)
  m.call(0x0038, RST38_ENQUEUE);

  regs.de = 0x06ad;
  m.step(0x6be4, 10); // 6be1  ld de,0x06ad
  m.push16(0x6be5);
  m.step(0x0038, 11); // 6be4  rst 0x38 (rets to 0x6be5)
  m.call(0x0038, RST38_ENQUEUE);

  regs.de = 0x06ae;
  m.step(0x6be8, 10); // 6be5  ld de,0x06ae
  m.push16(0x6be9);
  m.step(0x0038, 11); // 6be8  rst 0x38 (rets to 0x6be9)
  m.call(0x0038, RST38_ENQUEUE);

  regs.de = 0x06af;
  m.step(0x6bec, 10); // 6be9  ld de,0x06af
  m.step(0x6bae, 12); // 6bec  jr 0x6bae (tail)
  return m.call(0x6bae, TAIL_6BAE);
}
