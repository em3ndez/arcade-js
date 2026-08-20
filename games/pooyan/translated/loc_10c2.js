// SPDX-License-Identifier: GPL-3.0-only

// loc_10c2  (ROM 0x10c2-0x1118) -- adjust counter B by A (entry carry = direction), store it to
// 0x8f62, then render three 2-digit fields. B is walked up (carry set, 0x10c5 inc loop) or down
// (carry clear, 0x10cb dec loop) until A hits 0, leaving B as the new value. Each field is B->BCD
// via loc_1131 then drawn via loc_1119; a nonzero 0x8f60 bumps 0x8f62 and mirrors C to 0x85f2.
// Finally 0x8f5c is bumped and loc_0f44 fires a sound. 0x10c5 is the inlined inc-loop latch (no
// external callers) -- not a standalone routine.
export function loc_10c2(m) {
  const { regs, mem } = m;

  regs.c = regs.dec8(regs.c);        m.step(0x10c3, 4); // does not touch carry (entry dir latch)
  if (regs.fNC) {
    m.step(0x10cb, 12);              // jr nc,0x10cb -- decrement loop
    for (;;) {
      regs.b = regs.dec8(regs.b);    m.step(0x10cc, 4);
      regs.a = regs.dec8(regs.a);    m.step(0x10cd, 4);
      if (regs.fNZ) { m.step(0x10cb, 12); } else { m.step(0x10cf, 7); break; }
    }
    regs.a = regs.b;                 m.step(0x10d0, 4); // 10cf  ld a,b
  } else {
    m.step(0x10c5, 7);               // jr nc not taken -- increment loop (0x10c5)
    for (;;) {
      regs.b = regs.inc8(regs.b);    m.step(0x10c6, 4);
      regs.a = regs.inc8(regs.a);    m.step(0x10c7, 4);
      if (regs.fNZ) { m.step(0x10c5, 12); } else { m.step(0x10c9, 7); break; }
    }
    m.step(0x10d0, 12);              // 10c9  jr 0x10d0
  }

  regs.a = regs.b;                   m.step(0x10d1, 4);
  mem.write8(0x8f62, regs.a);        m.step(0x10d4, 13);
  regs.b = regs.sla(regs.b);         m.step(0x10d6, 8);
  m.push16(0x10d9);
  m.step(0x1131, 17);                // 10d6  call 0x1131 -- B -> BCD (A), hundreds (C)
  m.call(0x1131);
  regs.hl = 0x85d0;                  m.step(0x10dc, 10);
  m.push16(0x10df);
  m.step(0x1119, 17);                // 10dc  call 0x1119 -- draw field
  m.call(0x1119);
  regs.a = mem.read8(0x8f5e);        m.step(0x10e2, 13);
  regs.cp(0x0a);                     m.step(0x10e4, 7);
  if (regs.fC) {
    m.step(0x10ea, 12);              // jr c,0x10ea -- value < 10, skip re-encode
  } else {
    m.step(0x10e6, 7);
    regs.b = regs.a;                 m.step(0x10e7, 4);
    m.push16(0x10ea);
    m.step(0x1131, 17);              // 10e7  call 0x1131
    m.call(0x1131);
  }
  regs.hl = 0x8652;                  m.step(0x10ed, 10);
  m.push16(0x10f0);
  m.step(0x1119, 17);                // 10ed  call 0x1119 -- draw field
  m.call(0x1119);
  regs.hl = 0x8f60;                  m.step(0x10f3, 10);
  regs.a = mem.read8(regs.hl);       m.step(0x10f4, 7);
  regs.and(regs.a);                  m.step(0x10f5, 4);
  if (regs.fNZ) {
    m.step(0x10f7, 7);               // jr z not taken -- third field present
    regs.b = regs.a;                 m.step(0x10f8, 4);
    regs.l = 0x62;                   m.step(0x10fa, 7); // HL = 0x8f62
    regs.add(mem.read8(regs.hl));    m.step(0x10fb, 7);
    mem.write8(regs.hl, regs.a);     m.step(0x10fc, 7);
    regs.b = regs.sla(regs.b);       m.step(0x10fe, 8);
    m.push16(0x1101);
    m.step(0x1131, 17);              // 10fe  call 0x1131
    m.call(0x1131);
    regs.e = regs.a;                 m.step(0x1102, 4);
    regs.a = regs.c;                 m.step(0x1103, 4);
    regs.and(regs.a);                m.step(0x1104, 4);
    if (regs.fZ) {
      m.step(0x110a, 12);            // jr z,0x110a -- no hundreds carry
    } else {
      m.step(0x1106, 7);
      regs.a = regs.c;               m.step(0x1107, 4);
      mem.write8(0x85f2, regs.a);    m.step(0x110a, 13);
    }
    regs.hl = 0x85d2;                m.step(0x110d, 10);
    regs.a = regs.e;                 m.step(0x110e, 4);
    m.push16(0x1111);
    m.step(0x1119, 17);              // 110e  call 0x1119 -- draw field
    m.call(0x1119);
  } else {
    m.step(0x1111, 12);              // jr z,0x1111 -- skip third field
  }

  regs.hl = 0x8f5c;                  m.step(0x1114, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x1115, 11);
  m.push16(0x1118);
  m.step(0x0f44, 17);                // 1115  call 0x0f44 -- sound cue
  m.call(0x0f44);
  m.ret(10);
}
