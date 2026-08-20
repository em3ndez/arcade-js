// SPDX-License-Identifier: GPL-3.0-only

// loc_7912  (ROM 0x7912-0x795f) -- LEAF BCD-counter tick, no calls. If (0x8806)==0 bail. Pick a pair
// by (0x880d): zero -> gate 0x89e1 / counter 0x8a30, else gate 0x89e2 / counter 0x8a33. If the gate
// byte is nonzero bail. Otherwise tick the counter: bit0 of the flag byte at counter+1 picks the
// frame limit (0x3b or 0x3c); below it just inc, at it roll to 0 and BCD-carry into the next digit(s)
// -- each digit rolls its low nibble at 0x0a and its high nibble at 0x60. Ends in a plain ret.
export function loc_7912(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8806);
  m.step(0x7915, 13); // 7912  ld a,(0x8806)
  regs.and(regs.a);
  m.step(0x7916, 4); // 7915  and a
  if (regs.fZ) {
    m.ret(11); // 7916  ret z -- (0x8806)==0, inactive
    return;
  }
  m.step(0x7917, 5); // 7916  ret z (not taken)

  regs.a = mem.read8(0x880d);
  m.step(0x791a, 13); // 7917  ld a,(0x880d)
  regs.and(regs.a);
  m.step(0x791b, 4); // 791a  and a
  regs.de = 0x89e1;
  m.step(0x791e, 10); // 791b  ld de,0x89e1 -- gate byte
  regs.hl = 0x8a30;
  m.step(0x7921, 10); // 791e  ld hl,0x8a30 -- counter base
  if (regs.fZ) {
    m.step(0x7927, 12); // 7921  jr z,0x7927 -- (0x880d)==0, keep first pair
  } else {
    m.step(0x7923, 7); // 7921  jr z (not taken)
    regs.l = 0x33;
    m.step(0x7925, 7); // 7923  ld l,0x33 -> HL=0x8a33
    regs.e = 0xe2;
    m.step(0x7927, 7); // 7925  ld e,0xe2 -> DE=0x89e2
  }

  regs.a = mem.read8(regs.de);
  m.step(0x7928, 7); // 7927  ld a,(de) -- gate byte
  regs.and(regs.a);
  m.step(0x7929, 4); // 7928  and a
  if (regs.fNZ) {
    m.ret(11); // 7929  ret nz -- gate set, skip
    return;
  }
  m.step(0x792a, 5); // 7929  ret nz (not taken)

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x792b, 6); // 792a  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x792c, 7); // 792b  ld a,(hl) -- flag byte at counter+1
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x792d, 6); // 792c  dec hl
  regs.bit(0, regs.a);
  m.step(0x792f, 8); // 792d  bit 0,a
  regs.b = 0x3b;
  m.step(0x7931, 7); // 792f  ld b,0x3b -- frame limit
  if (regs.fNZ) {
    m.step(0x7933, 7); // 7931  jr z (not taken) -- bit0 set
    regs.b = regs.inc8(regs.b);
    m.step(0x7934, 4); // 7933  inc b -> 0x3c
  } else {
    m.step(0x7934, 12); // 7931  jr z,0x7934
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x7935, 7); // 7934  ld a,(hl) -- counter
  regs.cp(regs.b);
  m.step(0x7936, 4); // 7935  cp b
  if (regs.fNZ) {
    m.step(0x7938, 7); // 7936  jr z (not taken)
    regs.incMem8(mem, regs.hl);
    m.step(0x7939, 11); // 7938  inc (hl)
    m.ret(); // 7939  ret
    return;
  }
  m.step(0x793a, 12); // 7936  jr z,0x793a -- at limit, roll over

  mem.write8(regs.hl, 0x00);
  m.step(0x793c, 10); // 793a  ld (hl),0x00
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x793d, 6); // 793c  inc hl -- next digit
  regs.incMem8(mem, regs.hl);
  m.step(0x793e, 11); // 793d  inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x793f, 7); // 793e  ld a,(hl)
  regs.e = regs.a;
  m.step(0x7940, 4); // 793f  ld e,a
  regs.and(0x0f);
  m.step(0x7942, 7); // 7940  and 0x0f
  regs.cp(0x0a);
  m.step(0x7944, 7); // 7942  cp 0x0a
  if (regs.fNZ) {
    m.ret(11); // 7944  ret nz -- low nibble < 0x0a, done
    return;
  }
  m.step(0x7945, 5); // 7944  ret nz (not taken)

  regs.a = regs.e;
  m.step(0x7946, 4); // 7945  ld a,e
  regs.and(0xf0);
  m.step(0x7948, 7); // 7946  and 0xf0
  regs.add(0x10);
  m.step(0x794a, 7); // 7948  add a,0x10 -- BCD carry into high nibble
  regs.cp(0x60);
  m.step(0x794c, 7); // 794a  cp 0x60
  mem.write8(regs.hl, regs.a);
  m.step(0x794d, 7); // 794c  ld (hl),a
  if (regs.fNZ) {
    m.ret(11); // 794d  ret nz -- high nibble < 6, done
    return;
  }
  m.step(0x794e, 5); // 794d  ret nz (not taken)

  mem.write8(regs.hl, 0x00);
  m.step(0x7950, 10); // 794e  ld (hl),0x00
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x7951, 6); // 7950  inc hl -- next digit
  regs.incMem8(mem, regs.hl);
  m.step(0x7952, 11); // 7951  inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x7953, 7); // 7952  ld a,(hl)
  regs.e = regs.a;
  m.step(0x7954, 4); // 7953  ld e,a
  regs.and(0x0f);
  m.step(0x7956, 7); // 7954  and 0x0f
  regs.cp(0x0a);
  m.step(0x7958, 7); // 7956  cp 0x0a
  if (regs.fNZ) {
    m.ret(11); // 7958  ret nz -- low nibble < 0x0a, done
    return;
  }
  m.step(0x7959, 5); // 7958  ret nz (not taken)

  regs.a = regs.e;
  m.step(0x795a, 4); // 7959  ld a,e
  regs.and(0xf0);
  m.step(0x795c, 7); // 795a  and 0xf0
  regs.add(0x10);
  m.step(0x795e, 7); // 795c  add a,0x10
  mem.write8(regs.hl, regs.a);
  m.step(0x795f, 7); // 795e  ld (hl),a
  m.ret(); // 795f  ret
}
