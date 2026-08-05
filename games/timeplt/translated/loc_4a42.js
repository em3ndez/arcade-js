// SPDX-License-Identifier: GPL-3.0-only

// loc_4a42  (ROM 0x4A42-0x4A9C)
export function loc_4a42(m) {
  const { regs, mem } = m;

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4a43, 6); // 4a42  inc hl
  mem.write8(regs.hl, regs.a);
  m.step(0x4a44, 7); // 4a43  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4a45, 6); // 4a44  inc hl

  regs.b = 0x0d;
  m.step(0x4a47, 7); // 4a45  ld b,0x0d

  for (;;) {
    mem.write8(regs.hl, regs.c);
    m.step(0x4a48, 7); // 4a47  ld (hl),c
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4a49, 6); // 4a48  inc hl
    if (regs.djnz() !== 0) {
      m.step(0x4a47, 13); // 4a49  djnz 0x4a47 (taken)
      continue;
    }
    m.step(0x4a4b, 8); // 4a49  djnz (not taken)
    break;
  }

  regs.a = 0x0e;
  m.step(0x4a4d, 7); // 4a4b  ld a,0x0e
  regs.b = 0x04;
  m.step(0x4a4f, 7); // 4a4d  ld b,0x04

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4a50, 7); // 4a4f  ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4a51, 6); // 4a50  inc hl
    if (regs.djnz() !== 0) {
      m.step(0x4a4f, 13); // 4a51  djnz 0x4a4f (taken)
      continue;
    }
    m.step(0x4a53, 8); // 4a51  djnz (not taken)
    break;
  }

  regs.hl = 0xa7b1;
  m.step(0x4a56, 10); // 4a53  ld hl,0xa7b1
  regs.h = regs.res(2, regs.h);
  m.step(0x4a58, 8); // 4a56  res 2,h -- 0xa7b1 -> 0xa3b1, no flags

  regs.a = mem.read8(0xad0c);
  m.step(0x4a5b, 13); // 4a58  ld a,(0xad0c)
  regs.c = regs.a;
  m.step(0x4a5c, 4); // 4a5b  ld c,a -- the base colour, reused throughout
  regs.a = 0xa0;
  m.step(0x4a5e, 7); // 4a5c  ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a5f, 4); // 4a5e  add a,c

  m.push16(0x4a62);
  m.step(0x1319, 17); // 4a5f  call 0x1319 -- also leaves DE = 0xffe0
  m.call(0x1319);

  regs.hl = 0xa5d1;
  m.step(0x4a65, 10); // 4a62  ld hl,0xa5d1
  regs.h = regs.res(2, regs.h);
  m.step(0x4a67, 8); // 4a65  res 2,h -- 0xa1d1
  regs.a = 0x20;
  m.step(0x4a69, 7); // 4a67  ld a,0x20
  regs.add(regs.c);
  m.step(0x4a6a, 4); // 4a69  add a,c

  m.push16(0x4a6d);
  m.step(0x1319, 17); // 4a6a  call 0x1319
  m.call(0x1319);

  regs.hl = 0xa610;
  m.step(0x4a70, 10); // 4a6d  ld hl,0xa610
  regs.h = regs.res(2, regs.h);
  m.step(0x4a72, 8); // 4a70  res 2,h -- 0xa210
  regs.a = 0xa0;
  m.step(0x4a74, 7); // 4a72  ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a75, 4); // 4a74  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a76, 7); // 4a75  ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a77, 11); // 4a76  add hl,de -- DE is 0xffe0, so HL -= 0x20
  regs.a = 0x20;
  m.step(0x4a79, 7); // 4a77  ld a,0x20
  regs.add(regs.c);
  m.step(0x4a7a, 4); // 4a79  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a7b, 7); // 4a7a  ld (hl),a

  regs.hl = 0xa612;
  m.step(0x4a7e, 10); // 4a7b  ld hl,0xa612
  regs.h = regs.res(2, regs.h);
  m.step(0x4a80, 8); // 4a7e  res 2,h -- 0xa212
  regs.a = 0xe0;
  m.step(0x4a82, 7); // 4a80  ld a,0xe0
  regs.add(regs.c);
  m.step(0x4a83, 4); // 4a82  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a84, 7); // 4a83  ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a85, 11); // 4a84  add hl,de
  regs.a = 0x60;
  m.step(0x4a87, 7); // 4a85  ld a,0x60
  regs.add(regs.c);
  m.step(0x4a88, 4); // 4a87  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a89, 7); // 4a88  ld (hl),a

  regs.hl = 0xa611;
  m.step(0x4a8c, 10); // 4a89  ld hl,0xa611
  regs.h = regs.res(2, regs.h);
  m.step(0x4a8e, 8); // 4a8c  res 2,h -- 0xa211
  regs.a = 0xa0;
  m.step(0x4a90, 7); // 4a8e  ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a91, 4); // 4a90  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a92, 7); // 4a91  ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a93, 11); // 4a92  add hl,de
  regs.a = 0x20;
  m.step(0x4a95, 7); // 4a93  ld a,0x20
  regs.add(regs.c);
  m.step(0x4a96, 4); // 4a95  add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a97, 7); // 4a96  ld (hl),a

  m.push16(0x4a9a);
  m.step(0x339c, 17); // 4a97  call 0x339c
  m.call(0x339c);

  m.step(0x0f1a, 10); // 4a9a  jp 0x0f1a -- TAIL
  return m.call(0x0f1a);
}
