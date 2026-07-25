// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2b9b  (ROM 0x2B9B–0x2BE0) — tile gate; rejects or falls into entry_2be1.
 *
 *   2b9b  e5           push hl              ; save the ORIGINAL (y,x)
 *   2b9c  cd f0 2f     call 0x2ff0
 *  2b9f d1 pop de ; DE = the ORIGINAL HL
 *   2ba0  7e           ld   a,(hl)
 *   2ba1  fe b0        cp   0xb0
 *   2ba3  da d9 2b     jp   c,0x2bd9        ; REJECT: tile < 0xB0
 *   2ba6  e6 0f        and  0x0f
 *   2ba8  fe 08        cp   0x08
 *   2baa  d2 d9 2b     jp   nc,0x2bd9       ; REJECT: low nibble >= 8
 *   2bad  7e           ld   a,(hl)
 *   2bae  fe c0        cp   0xc0
 *   2bb0  ca d9 2b     jp   z,0x2bd9        ; REJECT: tile == 0xC0
 *   2bb3  da dc 2b     jp   c,0x2bdc        ; tile < 0xC0 -> loc_2bdc
 *   2bb6  fe d0        cp   0xd0
 *   2bb8  da cb 2b     jp   c,0x2bcb
 *   2bbb  fe e0        cp   0xe0
 *   2bbd  da c5 2b     jp   c,0x2bc5
 *   2bc0  fe f0        cp   0xf0
 *   2bc2  da cb 2b     jp   c,0x2bcb
 *   2bc5  e6 0f        and  0x0f            ; loc_2bc5
 *   2bc7  3d           dec  a
 *   2bc8  c3 cf 2b     jp   0x2bcf
 *   2bcb  e6 0f        and  0x0f            ; loc_2bcb
 *   2bcd  d6 09        sub  0x09
 *   2bcf  4f           ld   c,a             ; loc_2bcf
 *   2bd0  7b           ld   a,e
 *   2bd1  e6 f8        and  0xf8
 *   2bd3  81           add  a,c
 *   2bd4  4f           ld   c,a
 *   2bd5  bb           cp   e               ; first `cp r` in games/dkong/translated/ (S6)
 *   2bd6  da e1 2b     jp   c,0x2be1        ; SUCCESS 1 -> entry_2be1
 *   2bd9  af           xor  a               ; loc_2bd9 -- REJECT
 *   2bda  47           ld   b,a
 *   2bdb  c9           ret                  ; A=0, B=0
 *   2bdc  7b           ld   a,e             ; loc_2bdc
 *   2bdd  e6 f8        and  0xf8
 *   2bdf  3d           dec  a
 *   2be0  4f           ld   c,a
 *                      (falls into 0x2BE1)  ; SUCCESS 2 -- silent fall-through
 */
export function entry_2b9b(m) {
  const { regs, mem } = m;

  m.push16(regs.hl); // push hl -- saves the ORIGINAL (y,x) across the call
  m.step(0x2b9c, 11);
  m.push16(0x2b9f); // call 0x2ff0
  m.step(0x2ff0, 17);
  m.call(0x2ff0);
  regs.de = m.pop16(); // pop de -- recovers the ORIGINAL HL, not a return value
  m.step(0x2ba0, 10);

  regs.a = mem.read8(regs.hl);
  m.step(0x2ba1, 7); // ld a,(hl)
  regs.cp(0xb0);
  m.step(0x2ba3, 7); // cp 0xb0
  if (regs.fC) {
    m.step(0x2bd9, 10); // jp c,0x2bd9 -- REJECT (tile < 0xB0)
    return reject2b9b(m);
  }
  m.step(0x2ba6, 10);

  regs.and(0x0f);
  m.step(0x2ba8, 7); // and 0x0f
  regs.cp(0x08);
  m.step(0x2baa, 7); // cp 0x08
  if (regs.fNC) {
    m.step(0x2bd9, 10); // jp nc,0x2bd9 -- REJECT (low nibble >= 8)
    return reject2b9b(m);
  }
  m.step(0x2bad, 10);

  regs.a = mem.read8(regs.hl);
  m.step(0x2bae, 7); // ld a,(hl) -- reload the raw tile
  regs.cp(0xc0);
  m.step(0x2bb0, 7); // cp 0xc0
  if (regs.fZ) {
    m.step(0x2bd9, 10); // jp z,0x2bd9 -- REJECT (tile == 0xC0)
    return reject2b9b(m);
  }
  m.step(0x2bb3, 10);
  if (regs.fC) {
    m.step(0x2bdc, 10); // jp c,0x2bdc -- tile < 0xC0
    // ---- loc_2bdc: SUCCESS 2, the SILENT FALL-THROUGH into 0x2BE1 ----
    regs.a = regs.e;
    m.step(0x2bdd, 4); // ld a,e
    regs.and(0xf8);
    m.step(0x2bdf, 7); // and 0xf8
    regs.a = regs.dec8(regs.a);
    m.step(0x2be0, 4); // dec a
    regs.c = regs.a;
    m.step(0x2be1, 4); // ld c,a -- and then FALLS THROUGH into 0x2BE1
    return m.call(0x2be1); // now translated: 2b9b's success exit -> entry_2be1
  }
  m.step(0x2bb6, 10);

  // Classify the tile band; both arms converge on loc_2bcf.
  let at;
  regs.cp(0xd0);
  m.step(0x2bb8, 7); // cp 0xd0
  if (regs.fC) {
    m.step(0x2bcb, 10);
    at = 0x2bcb;
  } else {
    m.step(0x2bbb, 10);
    regs.cp(0xe0);
    m.step(0x2bbd, 7); // cp 0xe0
    if (regs.fC) {
      m.step(0x2bc5, 10);
      at = 0x2bc5;
    } else {
      m.step(0x2bc0, 10);
      regs.cp(0xf0);
      m.step(0x2bc2, 7); // cp 0xf0
      if (regs.fC) {
        m.step(0x2bcb, 10);
        at = 0x2bcb;
      } else {
        m.step(0x2bc5, 10); // jp c not taken -- falls into loc_2bc5
        at = 0x2bc5;
      }
    }
  }

  if (at === 0x2bc5) {
    regs.and(0x0f);
    m.step(0x2bc7, 7); // loc_2bc5: and 0x0f
    regs.a = regs.dec8(regs.a);
    m.step(0x2bc8, 4); // dec a
    m.step(0x2bcf, 10); // jp 0x2bcf
  } else {
    regs.and(0x0f);
    m.step(0x2bcd, 7); // loc_2bcb: and 0x0f
    regs.sub(0x09);
    m.step(0x2bcf, 7); // sub 0x09 -- falls into loc_2bcf
  }

  // ---- loc_2bcf: build the column in C and compare against E ----
  regs.c = regs.a;
  m.step(0x2bd0, 4); // ld c,a
  regs.a = regs.e;
  m.step(0x2bd1, 4); // ld a,e
  regs.and(0xf8);
  m.step(0x2bd3, 7); // and 0xf8
  regs.add(regs.c);
  m.step(0x2bd4, 4); // add a,c
  regs.c = regs.a;
  m.step(0x2bd5, 4); // ld c,a
  regs.cp(regs.e); // cp e -- first use of THIS operand; the cp r form is
  // precedented by cp b @ state0.js:1016 (see the S6 correction above)
  m.step(0x2bd6, 4);
  if (regs.fC) {
    m.step(0x2be1, 10); // jp c,0x2be1 -- SUCCESS 1
    return m.call(0x2be1); // now translated
  }
  m.step(0x2bd9, 10); // jp c not taken -- falls into the reject

  return reject2b9b(m);
}

/**
 * reject2b9b  (ROM 0x2B9B–0x2BDB) — entry_2b9b's REJECT tail: A=0, B=0, plain ret.
 */
export function reject2b9b(m) {
  const { regs } = m;
  regs.xor(regs.a);
  m.step(0x2bda, 4); // xor a
  regs.b = regs.a;
  m.step(0x2bdb, 4); // ld b,a
  m.ret(); // ret (0x2BDB)
}
