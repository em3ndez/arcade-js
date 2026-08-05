// SPDX-License-Identifier: GPL-3.0-only

// loc_0b93  (ROM 0x0B93-0x0BBB, Time Pilot)
export function loc_0b93(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.h = 0xac;
    m.step(0x0b95, 7); // ld h,0xac

    regs.a = mem.read8(0xa9b3);
    m.step(0x0b98, 13); // ld a,(0xa9b3) -- the read cursor

    regs.l = regs.a;
    m.step(0x0b99, 4); // ld l,a -- HL = 0xAC00 + cursor

    regs.a = mem.read8(regs.hl);
    m.step(0x0b9a, 7); // ld a,(hl)

    regs.rlca();
    m.step(0x0b9b, 4); // rlca -- carry = bit 7 of the entry

    if (regs.fC) {
      m.step(0x0b90, 10); // jp c,0x0b90 taken
      m.step(0x0b93, 10); // 0x0b90: jp 0x0b93
      continue;
    }
    m.step(0x0b9e, 10); // jp c not taken (jp costs 10 either way)

    regs.c = mem.read8(regs.hl);
    m.step(0x0b9f, 7); // ld c,(hl) -- the command byte

    mem.write8(regs.hl, 0xff);
    m.step(0x0ba1, 10); // ld (hl),0xff -- consumed

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0ba2, 6); // inc hl

    regs.b = mem.read8(regs.hl);
    m.step(0x0ba3, 7); // ld b,(hl) -- the argument byte

    mem.write8(regs.hl, 0xff);
    m.step(0x0ba5, 10); // ld (hl),0xff -- consumed

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0ba6, 6); // inc hl

    regs.a = regs.l;
    m.step(0x0ba7, 4); // ld a,l

    regs.and(0x3f);
    m.step(0x0ba9, 7); // and 0x3f -- wrap the cursor inside the 0x40-byte ring

    mem.write8(0xa9b3, regs.a);
    m.step(0x0bac, 13); // ld (0xa9b3),a

    regs.a = regs.c;
    m.step(0x0bad, 4); // ld a,c

    regs.and(0x0f);
    m.step(0x0baf, 7); // and 0x0f -- the handler index

    regs.hl = 0x0bbc;
    m.step(0x0bb2, 10); // ld hl,0x0bbc -- the dispatch table

    m.push16(0x0bb5);
    m.step(0x018c, 17); // call 0x018c -- DE = table[index]
    m.call(0x018c);

    regs.a = regs.b;
    m.step(0x0bb6, 4); // ld a,b -- the handler takes its argument in A

    regs.hl = 0x0b90;
    m.step(0x0bb9, 10); // ld hl,0x0b90

    m.push16(regs.hl);
    m.step(0x0bba, 11); // push hl -- the handler returns to 0x0B90, i.e. back here

    regs.exDeHl();
    m.step(0x0bbb, 4); // ex de,hl -- HL = the handler, DE = 0x0B90

    const target = regs.hl;
    m.step(target, 4); // jp (hl) -- computed dispatch
    m.call(target);

    if (m.pc !== 0x0b90) return m.call(m.pc);
    m.step(0x0b93, 10); // 0x0b90: jp 0x0b93
  }
}
