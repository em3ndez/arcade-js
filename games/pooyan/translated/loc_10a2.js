// SPDX-License-Identifier: GPL-3.0-only

// loc_10a2  (ROM 0x10a2-0x1118) -- HUD score/counter renderer for three work-RAM byte fields
// (0x8f5d, 0x8f5e, 0x8f60). For each field it optionally runs the BCD helper loc_1131 (when the
// raw value >= 0x0a), then paints two nibbles into a sprite/tile pair via loc_1119.
//   * 0x8f5d: if >= 0x0a, call 0x1131 first. Then paint at 0x8650. If the value is in 1..0x0b it is
//     re-centred around 5 (offset from 7) via the inc/dec loops, stashed at 0x8f62, doubled (sla),
//     re-run through 0x1131, and painted at 0x85d0. Value 0 or >= 0x0c skips that second paint.
//   * 0x8f5e: if >= 0x0a, call 0x1131 first. Then paint at 0x8652.
//   * 0x8f60: if non-zero, accumulate into 0x8f62, double it, BCD via 0x1131, optionally latch C to
//     0x85f2, and paint at 0x85d2.
// Finally bumps the main-loop sub-state (0x8f5c) and tail-calls loc_0f44.
const CALL_1131 = "0x1131 BCD tally helper (returns digit A, high-digit count C)";
const CALL_1119 = "0x1119 paint two nibbles into a HUD sprite/tile pair at (HL)";
const CALL_0F44 = "0x0f44 post-render tail";

export function loc_10a2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f5d);
  m.step(0x10a5, 13); // 10a2  ld a,(0x8f5d)
  regs.cp(0x0a);
  m.step(0x10a7, 7); // 10a5  cp 0x0a
  if (regs.fC) {
    m.step(0x10ad, 12); // 10a7  jr c,0x10ad (taken) -- < 0x0a, skip the BCD helper
  } else {
    m.step(0x10a9, 7); // 10a7  jr c (not taken)
    regs.b = regs.a;
    m.step(0x10aa, 4); // 10a9  ld b,a
    m.push16(0x10ad);
    m.step(0x1131, 17); // 10aa  call 0x1131
    m.call(0x1131, CALL_1131);
  }

  // loc_10ad:
  regs.hl = 0x8650;
  m.step(0x10b0, 10); // 10ad  ld hl,0x8650
  m.push16(0x10b3);
  m.step(0x1119, 17); // 10b0  call 0x1119
  m.call(0x1119, CALL_1119);
  regs.a = mem.read8(0x8f5d);
  m.step(0x10b6, 13); // 10b3  ld a,(0x8f5d)
  regs.and(regs.a);
  m.step(0x10b7, 4); // 10b6  and a
  if (regs.fZ) {
    m.step(0x10df, 12); // 10b7  jr z,0x10df (taken) -- zero: no second paint
  } else {
    m.step(0x10b9, 7); // 10b7  jr z (not taken)
    regs.cp(0x0c);
    m.step(0x10bb, 7); // 10b9  cp 0x0c
    if (regs.fNC) {
      m.step(0x10df, 12); // 10bb  jr nc,0x10df (taken) -- >= 0x0c: no second paint
    } else {
      m.step(0x10bd, 7); // 10bb  jr nc (not taken)
      regs.sub(0x07);
      m.step(0x10bf, 7); // 10bd  sub 0x07
      regs.b = 0x05;
      m.step(0x10c1, 7); // 10bf  ld b,0x05
      if (regs.fZ) {
        m.step(0x10d0, 12); // 10c1  jr z,0x10d0 (taken) -- value == 7, B stays 5
      } else {
        m.step(0x10c3, 7); // 10c1  jr z (not taken)
        if (regs.fNC) {
          m.step(0x10cb, 12); // 10c3  jr nc,0x10cb (taken) -- value > 7: count down
          // loc_10cb:
          for (;;) {
            regs.b = regs.dec8(regs.b);
            m.step(0x10cc, 4); // 10cb  dec b
            regs.a = regs.dec8(regs.a);
            m.step(0x10cd, 4); // 10cc  dec a
            if (regs.fNZ) {
              m.step(0x10cb, 12); // 10cd  jr nz,0x10cb (taken)
              continue;
            }
            m.step(0x10cf, 7); // 10cd  jr nz (not taken)
            break;
          }
          regs.a = regs.b;
          m.step(0x10d0, 4); // 10cf  ld a,b (falls into loc_10d0)
        } else {
          m.step(0x10c5, 7); // 10c3  jr nc (not taken) -- value < 7: count up
          // loc_10c5:
          for (;;) {
            regs.b = regs.inc8(regs.b);
            m.step(0x10c6, 4); // 10c5  inc b
            regs.a = regs.inc8(regs.a);
            m.step(0x10c7, 4); // 10c6  inc a
            if (regs.fNZ) {
              m.step(0x10c5, 12); // 10c7  jr nz,0x10c5 (taken)
              continue;
            }
            m.step(0x10c9, 7); // 10c7  jr nz (not taken)
            break;
          }
          m.step(0x10d0, 12); // 10c9  jr 0x10d0
        }
      }

      // loc_10d0:
      regs.a = regs.b;
      m.step(0x10d1, 4); // 10d0  ld a,b
      mem.write8(0x8f62, regs.a);
      m.step(0x10d4, 13); // 10d1  ld (0x8f62),a
      regs.b = regs.sla(regs.b);
      m.step(0x10d6, 8); // 10d4  sla b
      m.push16(0x10d9);
      m.step(0x1131, 17); // 10d6  call 0x1131
      m.call(0x1131, CALL_1131);
      regs.hl = 0x85d0;
      m.step(0x10dc, 10); // 10d9  ld hl,0x85d0
      m.push16(0x10df);
      m.step(0x1119, 17); // 10dc  call 0x1119
      m.call(0x1119, CALL_1119);
    }
  }

  // loc_10df:
  regs.a = mem.read8(0x8f5e);
  m.step(0x10e2, 13); // 10df  ld a,(0x8f5e)
  regs.cp(0x0a);
  m.step(0x10e4, 7); // 10e2  cp 0x0a
  if (regs.fC) {
    m.step(0x10ea, 12); // 10e4  jr c,0x10ea (taken)
  } else {
    m.step(0x10e6, 7); // 10e4  jr c (not taken)
    regs.b = regs.a;
    m.step(0x10e7, 4); // 10e6  ld b,a
    m.push16(0x10ea);
    m.step(0x1131, 17); // 10e7  call 0x1131
    m.call(0x1131, CALL_1131);
  }

  // loc_10ea:
  regs.hl = 0x8652;
  m.step(0x10ed, 10); // 10ea  ld hl,0x8652
  m.push16(0x10f0);
  m.step(0x1119, 17); // 10ed  call 0x1119
  m.call(0x1119, CALL_1119);
  regs.hl = 0x8f60;
  m.step(0x10f3, 10); // 10f0  ld hl,0x8f60
  regs.a = mem.read8(regs.hl);
  m.step(0x10f4, 7); // 10f3  ld a,(hl)
  regs.and(regs.a);
  m.step(0x10f5, 4); // 10f4  and a
  if (regs.fZ) {
    m.step(0x1111, 12); // 10f5  jr z,0x1111 (taken) -- zero: nothing to paint
  } else {
    m.step(0x10f7, 7); // 10f5  jr z (not taken)
    regs.b = regs.a;
    m.step(0x10f8, 4); // 10f7  ld b,a
    regs.l = 0x62;
    m.step(0x10fa, 7); // 10f8  ld l,0x62 (HL -> 0x8f62)
    regs.add(mem.read8(regs.hl));
    m.step(0x10fb, 7); // 10fa  add a,(hl)
    mem.write8(regs.hl, regs.a);
    m.step(0x10fc, 7); // 10fb  ld (hl),a
    regs.b = regs.sla(regs.b);
    m.step(0x10fe, 8); // 10fc  sla b
    m.push16(0x1101);
    m.step(0x1131, 17); // 10fe  call 0x1131
    m.call(0x1131, CALL_1131);
    regs.e = regs.a;
    m.step(0x1102, 4); // 1101  ld e,a
    regs.a = regs.c;
    m.step(0x1103, 4); // 1102  ld a,c
    regs.and(regs.a);
    m.step(0x1104, 4); // 1103  and a
    if (regs.fZ) {
      m.step(0x110a, 12); // 1104  jr z,0x110a (taken)
    } else {
      m.step(0x1106, 7); // 1104  jr z (not taken)
      regs.a = regs.c;
      m.step(0x1107, 4); // 1106  ld a,c
      mem.write8(0x85f2, regs.a);
      m.step(0x110a, 13); // 1107  ld (0x85f2),a
    }

    // loc_110a:
    regs.hl = 0x85d2;
    m.step(0x110d, 10); // 110a  ld hl,0x85d2
    regs.a = regs.e;
    m.step(0x110e, 4); // 110d  ld a,e
    m.push16(0x1111);
    m.step(0x1119, 17); // 110e  call 0x1119
    m.call(0x1119, CALL_1119);
  }

  // loc_1111:
  regs.hl = 0x8f5c;
  m.step(0x1114, 10); // 1111  ld hl,0x8f5c
  regs.incMem8(mem, regs.hl);
  m.step(0x1115, 11); // 1114  inc (hl)
  m.push16(0x1118);
  m.step(0x0f44, 17); // 1115  call 0x0f44
  m.call(0x0f44, CALL_0F44);
  m.ret(); // 1118  ret
}
