// SPDX-License-Identifier: GPL-3.0-only

// loc_0eac  (ROM 0x0eac-0x0eea, Time Pilot) — the 0x0bbc dispatch word at 0x0bca.
export function loc_0eac(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad01);
  m.step(0x0eaf, 13); // 0eac  ld a,(0xad01)
  regs.cp(0x64);
  m.step(0x0eb1, 7); // 0eaf  cp 0x64

  if (regs.fNC) {
    m.ret(11); // 0eb1  ret nc (taken)
    return;
  }
  m.step(0x0eb2, 5); // 0eb1  ret nc (not taken)

  regs.a = 0x0e;
  m.step(0x0eb4, 7); // 0eb2  ld a,0x0e
  m.push16(0x0eb7);
  m.step(0x0c0f, 17); // 0eb4  call 0x0c0f
  m.call(0x0c0f);

  m.push16(0x0eb8);
  m.step(0x0028, 11); // 0eb7  rst 0x28 -- DE += 0x20
  m.call(0x0028);

  m.push16(0x0eb9);
  m.step(0x0028, 11); // 0eb8  rst 0x28 -- DE += 0x20
  m.call(0x0028);

  regs.hl = 0xad01;
  m.step(0x0ebc, 10); // 0eb9  ld hl,0xad01
  regs.b = 0x01;
  m.step(0x0ebe, 7); // 0ebc  ld b,0x01
  regs.a = mem.read8(0xad0c);
  m.step(0x0ec1, 13); // 0ebe  ld a,(0xad0c)
  regs.c = regs.a;
  m.step(0x0ec2, 4); // 0ec1  ld c,a
  m.push16(regs.bc);
  m.step(0x0ec3, 11); // 0ec2  push bc
  regs.c = 0x00;
  m.step(0x0ec5, 7); // 0ec3  ld c,0x00

  regs.a = mem.read8(regs.hl);
  m.step(0x0ec6, 7); // 0ec5  ld a,(hl) -- (0xad01), loaded OUTSIDE the loop below

  for (;;) {
    regs.sub(0x0a);
    m.step(0x0ec8, 7); // 0ec6  sub 0x0a
    if (regs.fC) {
      m.step(0x0ecd, 12); // 0ec8  jr c,0x0ecd (taken)
      break;
    }
    m.step(0x0eca, 7); // 0ec8  jr c,0x0ecd (not taken)
    regs.c = regs.inc8(regs.c);
    m.step(0x0ecb, 4); // 0eca  inc c
    m.step(0x0ec6, 12); // 0ecb  jr 0x0ec6
  }

  regs.add(0x0a);
  m.step(0x0ecf, 7); // 0ecd  add a,0x0a
  regs.exAf();
  m.step(0x0ed0, 4); // 0ecf  ex af,af'
  regs.a = regs.c;
  m.step(0x0ed1, 4); // 0ed0  ld a,c
  regs.bc = m.pop16();
  m.step(0x0ed2, 10); // 0ed1  pop bc

  m.push16(0x0ed5);
  m.step(0x0eeb, 17); // 0ed2  call 0x0eeb
  m.call(0x0eeb);

  m.push16(0x0ed6);
  m.step(0x0020, 11); // 0ed5  rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.exAf();
  m.step(0x0ed7, 4); // 0ed6  ex af,af'

  m.push16(0x0eda);
  m.step(0x0eeb, 17); // 0ed7  call 0x0eeb
  m.call(0x0eeb);

  m.push16(0x0edb);
  m.step(0x0020, 11); // 0eda  rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.de = 0x1748;
  m.step(0x0ede, 10); // 0edb  ld de,0x1748
  regs.bc = 0x108c;
  m.step(0x0ee1, 10); // 0ede  ld bc,0x108c -- B = 0x10, C = 0x8c

  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x0ee2, 7); // 0ee1  ld a,(de)
    regs.add(regs.c);
    m.step(0x0ee3, 4); // 0ee2  add a,c
    regs.c = regs.a;
    m.step(0x0ee4, 4); // 0ee3  ld c,a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0ee5, 6); // 0ee4  inc de
    if (regs.djnz() !== 0) {
      m.step(0x0ee1, 13); // 0ee5  djnz 0x0ee1 (taken) -- djnz sets no flags
      continue;
    }
    m.step(0x0ee7, 8); // 0ee5  djnz 0x0ee1 (not taken)
    break;
  }

  if (regs.fNZ) {
    m.step(0x2509, 10); // 0ee7  jp nz,0x2509 (taken) -- Z is still the last add a,c
    throw new Error(
      "Time Pilot: `jp nz,0x2509` at 0x0EE7 taken -- ROM 0x1748-0x1757 summed onto the " +
        "0x8C seed did not come to 0x00. 0x2509 is data; code resumes at 0x2511.",
    );
  }
  m.step(0x0eea, 10); // 0ee7  jp nz,0x2509 (not taken)

  m.ret(); // 0eea  ret
}
