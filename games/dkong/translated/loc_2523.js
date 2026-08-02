// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2523  (ROM 0x2523–0x2590).
 */
export function loc_2523(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.hl = 0x639b; // LIVE to 0x258F
  m.step(0x2526, 10); // ld hl,0x639b
  regs.a = mem.read8(regs.hl);
  m.step(0x2527, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x2528, 4); // and a -- timer == 0?
  if (regs.fNZ) {
    m.step(0x258f, 10); // jp nz,0x258f -- timer running
    return decAndRet();
  }
  m.step(0x252b, 10); // jp nz not taken

  regs.a = mem.read8(0x639a);
  m.step(0x252e, 13); // ld a,(0x639a)
  regs.and(regs.a);
  m.step(0x252f, 4); // and a -- request == 0?
  if (regs.fZ) {
    m.ret(11); // ret z -- no request (skips the dec)
    return;
  }
  m.step(0x2530, 5); // ret z NOT taken

  // -- free-slot scan --
  regs.b = 0x06;
  m.step(0x2532, 7); // ld b,0x06
  regs.de = 0x0010;
  m.step(0x2535, 10); // ld de,0x0010
  regs.ix = 0x65a0;
  m.step(0x2539, 14); // ld ix,0x65a0
  for (;;) {
    regs.bit(0, mem.read8(IX(0x00)));
    m.step(0x253d, 20); // bit 0,(ix+0x00)
    if (regs.fZ) {
      m.step(0x2545, 10); // jp z,0x2545 -- free slot
      break;
    }
    m.step(0x2540, 10); // jp z not taken
    regs.addIx(regs.de);
    m.step(0x2542, 15); // add ix,de
    regs.djnz();
    if (regs.b !== 0) {
      m.step(0x2539, 13); // djnz taken
      continue;
    }
    m.step(0x2544, 8); // djnz not taken
    m.ret(); // no free slot -- nothing spawned (skips the dec)
    return;
  }

  // -- loc_2545: spawn -- roll for the type --
  let toType = false;
  m.push16(0x2548);
  m.step(0x0057, 17);
  m.call(0x0057); // pseudo-random -> A
  regs.cp(0x60);
  m.step(0x254a, 7); // cp 0x60
  mem.write8(IX(0x05), 0x7c); // ld (ix+0x05),0x7c -- default field5
  m.step(0x254e, 19);
  if (regs.fC) {
    toType = true;
    m.step(0x2558, 10); // jp c,0x2558 -- random < 0x60
  } else {
    m.step(0x2551, 10); // jp c not taken
    regs.a = mem.read8(0x62a3);
    m.step(0x2554, 13); // ld a,(0x62a3)
    regs.a = regs.dec8(regs.a);
    m.step(0x2555, 4); // dec a
    if (regs.fNZ) {
      // -- loc_256e: re-roll --
      m.step(0x256e, 10); // jp nz,0x256e
      m.push16(0x2571);
      m.step(0x0057, 17);
      m.call(0x0057); // SECOND RNG draw
      regs.cp(0x68);
      m.step(0x2573, 7); // cp 0x68
      m.step(0x2560, 10); // jp 0x2560 -- into the field3 block (carry = cp 0x68's)
    } else {
      m.step(0x2558, 5); // jp nz not taken -> fall into 0x2558
      toType = true;
    }
  }

  if (toType) {
    // -- loc_2558 --
    mem.write8(IX(0x05), 0xcc); // ld (ix+0x05),0xcc -- override field5
    m.step(0x255c, 19);
    regs.a = mem.read8(0x62a6);
    m.step(0x255f, 13); // ld a,(0x62a6)
    regs.rlca(); // carry = bit 7 of 0x62A6
    m.step(0x2560, 4);
  }
  // -- loc_2560: field3 default, carry preserved from rlca OR cp 0x68 --
  mem.write8(IX(0x03), 0x07); // ld (ix+0x03),0x07 -- FLAG-NEUTRAL
  m.step(0x2564, 19);
  if (regs.fC) {
    m.step(0x2567, 10); // jp nc not taken
    mem.write8(IX(0x03), 0xf8); // ld (ix+0x03),0xf8 -- override
    m.step(0x256b, 19);
    m.step(0x2576, 10); // jp 0x2576
  } else {
    m.step(0x2576, 10); // jp nc,0x2576 -- keep 0x07
  }

  // -- loc_2576: activate the object --
  mem.write8(IX(0x00), 0x01);
  m.step(0x257a, 19); // ld (ix+0x00),0x01
  mem.write8(IX(0x07), 0x4b);
  m.step(0x257e, 19); // ld (ix+0x07),0x4b
  mem.write8(IX(0x09), 0x08);
  m.step(0x2582, 19); // ld (ix+0x09),0x08
  mem.write8(IX(0x0a), 0x03);
  m.step(0x2586, 19); // ld (ix+0x0a),0x03
  regs.a = 0x7c;
  m.step(0x2588, 7); // ld a,0x7c
  mem.write8(0x639b, regs.a); // reload timer
  m.step(0x258b, 13); // ld (0x639b),a
  regs.xor(regs.a); // A = 0
  m.step(0x258c, 4);
  mem.write8(0x639a, regs.a); // clear request
  m.step(0x258f, 13); // ld (0x639a),a
  return decAndRet();

  function decAndRet() {
    // -- loc_258f: dec (hl) ; ret -- SHARED tail, HL is PATH-DEPENDENT:
    //   timer path -> HL = 0x639B (untouched);
    //   spawn path -> HL = sub_0057's leftover (0x639B stays 0x7C from the reload).
    regs.decMem8(mem, regs.hl); // dec (hl) -- the LIVE register, target differs by path
    m.step(0x2590, 11);
    m.ret();
  }
}
