// SPDX-License-Identifier: GPL-3.0-only

// loc_72a7  (ROM 0x72a7-0x72ce) -- eagle-launch driver. While the launch flag (0x8f3a) is 0 it seeds
// the wave via 0x72e1 and returns. Once launched, if the record-count (0x8f3c) is 0 it tail-jumps to
// the idle handler 0x73e3; otherwise it walks 2*(0x8f3d) records of the 0x8ae0 table (stride 0x18,
// IX) running the per-record state machine 0x72cf on each (exx parks B/DE across the callee).
export function loc_72a7(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f3a;
  m.step(0x72aa, 10); // 72a7  ld hl,0x8f3a
  regs.a = mem.read8(regs.hl);
  m.step(0x72ab, 7); // 72aa  ld a,(hl)
  regs.and(regs.a);
  m.step(0x72ac, 4); // 72ab  and a
  if (regs.fNZ) {
    m.step(0x72b2, 12); // 72ac  jr nz,0x72b2
  } else {
    m.step(0x72ae, 7);
    m.push16(0x72b1);
    m.step(0x72e1, 17); // 72ae  call 0x72e1
    m.call(0x72e1);
    m.ret(); // 72b1  ret
    return;
  }

  regs.a = mem.read8(0x8f3c);
  m.step(0x72b5, 13); // 72b2  ld a,(0x8f3c)
  regs.and(regs.a);
  m.step(0x72b6, 4); // 72b5  and a
  if (regs.fZ) {
    m.step(0x73e3, 10); // 72b6  jp z,0x73e3
    return m.call(0x73e3);
  }
  m.step(0x72b9, 10);
  regs.ix = 0x8ae0;
  m.step(0x72bd, 14); // 72b9  ld ix,0x8ae0
  regs.de = 0x0018;
  m.step(0x72c0, 10); // 72bd  ld de,0x0018
  regs.a = mem.read8(0x8f3d);
  m.step(0x72c3, 13); // 72c0  ld a,(0x8f3d)
  regs.add(regs.a);
  m.step(0x72c4, 4); // 72c3  add a,a
  regs.b = regs.a;
  m.step(0x72c5, 4); // 72c4  ld b,a
  for (;;) {
    regs.exx();
    m.step(0x72c6, 4); // 72c5  exx -- park B/DE in the alt set
    m.push16(0x72c9);
    m.step(0x72cf, 17); // 72c6  call 0x72cf
    m.call(0x72cf);
    regs.exx();
    m.step(0x72ca, 4); // 72c9  exx -- restore B/DE
    regs.addIx(regs.de);
    m.step(0x72cc, 15); // 72ca  add ix,de
    if (regs.djnz() !== 0) { m.step(0x72c5, 13); continue; } // 72cc  djnz 0x72c5
    m.step(0x72ce, 8);
    break;
  }
  m.ret(); // 72ce  ret
}
