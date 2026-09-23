// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fe3 (ROM 0x2fe3-0x3028, The Pit) -- the position/oscillator body of loc_2f71, run on the
 * frames the element moves. x (0x80db) += velocity (0x80df), bouncing in [0x19,0x38); y (0x80de) +=
 * an accelerating step (0x80e0, pre-incremented); on y>=0x86 it clamps y=0x86, calls 0x4b1a (a real
 * call/ret), resets the step (or 0xf8 / dec), bumps (0x80dd) bit-3-clear. Falls through into the
 * publish tail loc_3029 (no ret of its own -- loc_3029 tail-jumps to 0x312d), so each exit returns
 * loc_3029's result to OUR caller. Work-RAM stores only. Verbatim internal-label slice of loc_2f71
 * (its own 0x2fe3 label); the full per-instruction trace lives in loc_2f71.
 */
export function loc_2fe3(m) {
  const { regs, mem } = m;

  // loc_2fe3: horizontal oscillator on x (0x80db) with velocity (0x80df)
  regs.a = mem.read8(0x80df);
  m.step(0x2fe6, 13);
  regs.c = regs.a;
  m.step(0x2fe7, 4);
  regs.a = mem.read8(0x80db);
  m.step(0x2fea, 13);
  regs.add(regs.c);
  m.step(0x2feb, 4);
  mem.write8(0x80db, regs.a);
  m.step(0x2fee, 13);
  regs.cp(0x38);
  m.step(0x2ff0, 7);
  // 2ff0  jr c,0x2ff6
  if (regs.fC) {
    m.step(0x2ff6, 12); // jr c taken -- x < 0x38
    // loc_2ff6: cp 0x19
    regs.cp(0x19);
    m.step(0x2ff8, 7);
    // 2ff8  jr nc,0x2fff -- x in [0x19,0x38): leave velocity unchanged
    if (regs.fNC) {
      m.step(0x2fff, 12); // jr nc taken -> skip the velocity store
    } else {
      m.step(0x2ffa, 7); // jr nc NOT taken -- x < 0x19: velocity := +1
      // 2ffa  ld a,0x01
      regs.a = 0x01;
      m.step(0x2ffc, 7);
      // loc_2ffc: ld (0x80df),a
      mem.write8(0x80df, regs.a);
      m.step(0x2fff, 13);
    }
  } else {
    m.step(0x2ff2, 7); // jr c NOT taken -- x >= 0x38: velocity := -1 (0xff)
    // 2ff2  ld a,0xff
    regs.a = 0xff;
    m.step(0x2ff4, 7);
    // 2ff4  jr 0x2ffc
    m.step(0x2ffc, 12);
    // loc_2ffc: ld (0x80df),a
    mem.write8(0x80df, regs.a);
    m.step(0x2fff, 13);
  }

  // loc_2fff: vertical scroll y (0x80de) by the accelerating step (0x80e0)
  regs.a = mem.read8(0x80e0);
  m.step(0x3002, 13); // 2fff  ld a,(0x80e0)
  regs.a = regs.inc8(regs.a);
  m.step(0x3003, 4); // 3002  inc a -- accelerate the step
  mem.write8(0x80e0, regs.a);
  m.step(0x3006, 13); // 3003  ld (0x80e0),a
  regs.b = regs.a;
  m.step(0x3007, 4); // 3006  ld b,a
  regs.a = mem.read8(0x80de);
  m.step(0x300a, 13); // 3007  ld a,(0x80de)
  regs.add(regs.b);
  m.step(0x300b, 4); // 300a  add a,b
  mem.write8(0x80de, regs.a);
  m.step(0x300e, 13); // 300b  ld (0x80de),a
  regs.cp(0x86);
  m.step(0x3010, 7); // 300e  cp 0x86
  // 3010  jr c,0x3029 -- still on-screen: straight to publish
  if (regs.fC) {
    m.step(0x3029, 12);
    return m.call(0x3029);
  }
  m.step(0x3012, 7); // jr c NOT taken -- y >= 0x86: clamp, retrigger, reset step

  // 3012  ld a,0x86
  regs.a = 0x86;
  m.step(0x3014, 7);
  // 3014  ld (0x80de),a -- clamp y
  mem.write8(0x80de, regs.a);
  m.step(0x3017, 13);
  // 3017  call 0x4b1a
  m.push16(0x301a);
  m.step(0x4b1a, 17);
  m.call(0x4b1a);
  // 301a  or 0xf8
  regs.or(0xf8);
  m.step(0x301c, 7);
  // 301c  dec a
  regs.a = regs.dec8(regs.a);
  m.step(0x301d, 4);
  // 301d  ld (0x80e0),a -- reset the accelerating step
  mem.write8(0x80e0, regs.a);
  m.step(0x3020, 13);
  // 3020  ld a,(0x80dd)
  regs.a = mem.read8(0x80dd);
  m.step(0x3023, 13);
  // 3023  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x3024, 4);
  // 3024  and 0xf7 -- clear bit 3
  regs.and(0xf7);
  m.step(0x3026, 7);
  // 3026  ld (0x80dd),a
  mem.write8(0x80dd, regs.a);
  m.step(0x3029, 13);

  // fall through into loc_3029 (its own routine): its downstream ret returns to OUR caller
  return m.call(0x3029);
}
