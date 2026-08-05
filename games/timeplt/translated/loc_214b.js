// SPDX-License-Identifier: GPL-3.0-only

// loc_214b  (ROM 0x214B-0x218B, Time Pilot)
export function loc_214b(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.hl = 0xadf2;
    m.step(0x214e, 10); // ld hl,0xadf2 -- the countdown cell
    regs.a = mem.read8(regs.hl);
    m.step(0x214f, 7); // ld a,(hl)
    regs.b = regs.a;
    m.step(0x2150, 4); // ld b,a -- B keeps the whole byte, steering bits included
    regs.and(0x3f);
    m.step(0x2152, 7); // and 0x3f -- just the duration

    let advance;
    if (regs.fZ) {
      m.step(0x215b, 12); // jr z,0x215b taken -- duration 0, fetch the next byte
      advance = true;
    } else {
      m.step(0x2154, 7); // jr z not taken
      regs.a = regs.dec8(regs.a);
      m.step(0x2155, 4); // dec a
      if (regs.fZ) {
        m.step(0x215b, 12); // jr z,0x215b taken -- duration 1, fetch the next byte
        advance = true;
      } else {
        m.step(0x2157, 7); // jr z not taken -- still running
        advance = false;
      }
    }

    if (!advance) {
      regs.b = regs.dec8(regs.b);
      m.step(0x2158, 4); // dec b
      mem.write8(regs.hl, regs.b);
      m.step(0x2159, 7); // ld (hl),b -- the ticked countdown
      m.step(0x216a, 12); // jr 0x216a
      break;
    }

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x215c, 6); // inc hl -- 0xadf3
    regs.e = mem.read8(regs.hl);
    m.step(0x215d, 7); // ld e,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x215e, 6); // inc hl -- 0xadf4
    regs.d = mem.read8(regs.hl);
    m.step(0x215f, 7); // ld d,(hl) -- DE = the script pointer
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x2160, 6); // inc de
    mem.write8(regs.hl, regs.d);
    m.step(0x2161, 7); // ld (hl),d
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x2162, 6); // dec hl -- back to 0xadf3
    mem.write8(regs.hl, regs.e);
    m.step(0x2163, 7); // ld (hl),e -- the advanced pointer is stored
    regs.exDeHl();
    m.step(0x2164, 4); // ex de,hl -- HL = the script pointer, DE = 0xadf3
    regs.a = mem.read8(regs.hl);
    m.step(0x2165, 7); // ld a,(hl) -- the next script byte
    regs.de = (regs.de - 1) & 0xffff;
    m.step(0x2166, 6); // dec de -- 0xadf2
    regs.a = regs.inc8(regs.a);
    m.step(0x2167, 4); // inc a -- stored as byte+1, as loc_210E does
    mem.write8(regs.de, regs.a);
    m.step(0x2168, 7); // ld (de),a
    m.step(0x214b, 12); // jr 0x214b -- round again on the new countdown
  }

  regs.a = regs.b;
  m.step(0x216b, 4); // ld a,b
  regs.exx(); // BC/DE/HL <-> BC'/DE'/HL'; A and F are untouched
  m.step(0x216c, 4); // exx -- NEVER undone: this routine leaves on the shadow bank
  regs.rlca();
  m.step(0x216d, 4); // rlca
  regs.rlca();
  m.step(0x216e, 4); // rlca
  regs.and(0x03);
  m.step(0x2170, 7); // and 0x03 -- the two steering bits, now in 1:0

  if (regs.fZ) {
    m.step(0x1f42, 10); // jp z,0x1f42 taken -- no steer
    return m.call(0x1f42);
  }
  m.step(0x2173, 10); // jp z not taken

  regs.a = regs.dec8(regs.a);
  m.step(0x2174, 4); // dec a
  if (regs.fZ) {
    m.step(0x2181, 12); // jr z,0x2181 taken -- command 1
    regs.a = mem.read8(0xa802);
    m.step(0x2184, 13); // ld a,(0xa802)
    regs.sub(0x03);
    m.step(0x2186, 7); // sub 0x03
    mem.write8(0xa802, regs.a);
    m.step(0x2189, 13); // ld (0xa802),a
    m.step(0x1f42, 10); // jp 0x1f42 -- TAIL jump, nothing pushed
    return m.call(0x1f42);
  }
  m.step(0x2176, 7); // jr z not taken -- command 2 or 3

  regs.a = mem.read8(0xa802);
  m.step(0x2179, 13); // ld a,(0xa802)
  regs.add(0x03);
  m.step(0x217b, 7); // add a,0x03
  mem.write8(0xa802, regs.a);
  m.step(0x217e, 13); // ld (0xa802),a
  m.step(0x1f42, 10); // jp 0x1f42 -- TAIL jump, nothing pushed
  return m.call(0x1f42);
}
