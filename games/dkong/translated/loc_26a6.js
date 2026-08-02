// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_26a6  (ROM 0x26A6–0x26DD) — 56 bytes, 36 instructions; calls nothing.
 *
 *   26a6  2c           inc  l
 *   26a7  1a           ld   a,(de)
 *   26a8  17           rla                 ; carry = bit 7 of mem[DE]
 *   26a9  da c5 26     jp   c,0x26c5
 *   -- carry-CLEAR arm (bit7=0): (P) += 1 wrap 0x53->0x50 ; (P+4) -= 1 wrap 0xCF->0xD2
 *   26ac  7e           ld   a,(hl)
 *   26ad  3c           inc  a
 *   26ae  fe 53        cp   0x53
 *   26b0  c2 b5 26     jp   nz,0x26b5
 *   26b3  3e 50        ld   a,0x50
 *   26b5  77           ld   (hl),a
 *   26b6  7d           ld   a,l
 *   26b7  c6 04        add  a,0x04
 *   26b9  6f           ld   l,a
 *   26ba  7e           ld   a,(hl)
 *   26bb  3d           dec  a
 *   26bc  fe cf        cp   0xcf
 *   26be  c2 c3 26     jp   nz,0x26c3
 *   26c1  3e d2        ld   a,0xd2
 *   26c3  77           ld   (hl),a
 *   26c4  c9           ret
 *   -- carry-SET arm (bit7=1): (P) -= 1 wrap 0x4F->0x52 ; (P+4) += 1 wrap 0xD3->0xD0
 *   26c5  7e           ld   a,(hl)
 *   26c6  3d           dec  a
 *   26c7  fe 4f        cp   0x4f
 *   26c9  c2 ce 26     jp   nz,0x26ce
 *   26cc  3e 52        ld   a,0x52
 *   26ce  77           ld   (hl),a
 *   26cf  7d           ld   a,l
 *   26d0  c6 04        add  a,0x04
 *   26d2  6f           ld   l,a
 *   26d3  7e           ld   a,(hl)
 *   26d4  3c           inc  a
 *   26d5  fe d3        cp   0xd3
 *   26d7  c2 dc 26     jp   nz,0x26dc
 *   26da  3e d0        ld   a,0xd0
 *   26dc  77           ld   (hl),a
 *   26dd  c9           ret
 *
 * HL and DE are BOTH live-in (three callers do `ld de,0x69Ex / ex de,hl`): HL is
 * the write target 0x69E4/0x69EC/0x69F4, DE points at the arm-select byte (its
 * value is the caller's pre-ex HL, untraced). `rla` puts bit 7 of
 * mem[DE] into carry; the rotated A is dead (overwritten below), so only the
 * carry-out matters.
 *
 * The two arms are MIRRORS with inc<->dec swapped and the four constants
 * inverted. They are transcribed from the bytes INDEPENDENTLY, not
 * one copied from the other -- a missed inc/dec flip is byte-plausible (3C vs 3D,
 * same flags) and would invert one counter's direction.
 *
 * `inc l` @ 0x26A6: the flag-SETTING form (regs.inc8), per the boot.js:300 /
 * sub_2913 precedent. Its S/Z/H/PV flags are in fact DEAD here -- rla preserves
 * S/Z/PV then the arm's inc a/dec a overwrites them before any conditional reads
 * -- but the faithful form removes any latent-flag doubt (C is preserved either
 * way; inc does not touch carry). Each arm does two single-VALUE-wrap RMW stores
 * at P=HL+1 and P+4, the second address computed by threading L --
 * the wrap is an exact-value guard, not a range clamp, so an off-band cell walks
 * freely. A is live-out (the P+4 result); flags at the ret are from
 * the final `cp`.
 */
export function loc_26a6(m) {
  const { regs, mem } = m;

  regs.l = regs.inc8(regs.l); // inc l -- 8-bit; flags dead here (see doc), C kept
  m.step(0x26a7, 4); // inc l
  regs.a = mem.read8(regs.de);
  m.step(0x26a8, 7); // ld a,(de)
  regs.rla(); // carry = bit 7 of mem[DE]; rotated A is dead
  m.step(0x26a9, 4); // rla

  if (regs.fC) {
    // ---- carry-SET arm: (P) counts DOWN, (P+4) counts UP ----
    m.step(0x26c5, 10); // jp c,0x26c5 TAKEN

    regs.a = mem.read8(regs.hl);
    m.step(0x26c6, 7); // ld a,(hl)
    regs.a = regs.dec8(regs.a);
    m.step(0x26c7, 4); // dec a
    regs.cp(0x4f);
    m.step(0x26c9, 7); // cp 0x4f
    if (!regs.fZ) {
      m.step(0x26ce, 10); // jp nz,0x26ce -- store the decremented value
    } else {
      m.step(0x26cc, 10);
      regs.a = 0x52;
      m.step(0x26ce, 7); // ld a,0x52 -- wrap
    }
    mem.write8(regs.hl, regs.a);
    m.step(0x26cf, 7); // ld (hl),a

    regs.a = regs.l;
    m.step(0x26d0, 4); // ld a,l
    regs.add(0x04);
    m.step(0x26d2, 7); // add a,0x04
    regs.l = regs.a;
    m.step(0x26d3, 4); // ld l,a -- HL now P+4

    regs.a = mem.read8(regs.hl);
    m.step(0x26d4, 7); // ld a,(hl)
    regs.a = regs.inc8(regs.a);
    m.step(0x26d5, 4); // inc a
    regs.cp(0xd3);
    m.step(0x26d7, 7); // cp 0xd3
    if (!regs.fZ) {
      m.step(0x26dc, 10); // jp nz,0x26dc
    } else {
      m.step(0x26da, 10);
      regs.a = 0xd0;
      m.step(0x26dc, 7); // ld a,0xd0 -- wrap
    }
    mem.write8(regs.hl, regs.a);
    m.step(0x26dd, 7); // ld (hl),a
    m.ret(); // 0x26DD -- returns A = the P+4 result
    return;
  }
  m.step(0x26ac, 10); // jp c,0x26c5 NOT taken -- carry-CLEAR arm

  // ---- carry-CLEAR arm: (P) counts UP, (P+4) counts DOWN ----
  regs.a = mem.read8(regs.hl);
  m.step(0x26ad, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x26ae, 4); // inc a
  regs.cp(0x53);
  m.step(0x26b0, 7); // cp 0x53
  if (!regs.fZ) {
    m.step(0x26b5, 10); // jp nz,0x26b5 -- store the incremented value
  } else {
    m.step(0x26b3, 10);
    regs.a = 0x50;
    m.step(0x26b5, 7); // ld a,0x50 -- wrap
  }
  mem.write8(regs.hl, regs.a);
  m.step(0x26b6, 7); // ld (hl),a

  regs.a = regs.l;
  m.step(0x26b7, 4); // ld a,l
  regs.add(0x04);
  m.step(0x26b9, 7); // add a,0x04
  regs.l = regs.a;
  m.step(0x26ba, 4); // ld l,a -- HL now P+4

  regs.a = mem.read8(regs.hl);
  m.step(0x26bb, 7); // ld a,(hl)
  regs.a = regs.dec8(regs.a);
  m.step(0x26bc, 4); // dec a
  regs.cp(0xcf);
  m.step(0x26be, 7); // cp 0xcf
  if (!regs.fZ) {
    m.step(0x26c3, 10); // jp nz,0x26c3
  } else {
    m.step(0x26c1, 10);
    regs.a = 0xd2;
    m.step(0x26c3, 7); // ld a,0xd2 -- wrap
  }
  mem.write8(regs.hl, regs.a);
  m.step(0x26c4, 7); // ld (hl),a
  m.ret(); // 0x26C4 -- returns A = the P+4 result
}
