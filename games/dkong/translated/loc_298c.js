// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_298c  (ROM 0x298C–0x29AE) — / loc_29ac -- (tile-in-range predicate; -> A).
 *
 *   298c  2a c8 63     ld   hl,(0x63c8)
 *   298f  7d           ld   a,l
 *   2990  c6 0e        add  a,0x0e
 *   2992  6f           ld   l,a
 *   2993  56           ld   d,(hl)         ; D = table[+0x0E]
 *   2994  2c           inc  l
 *   2995  7e           ld   a,(hl)
 *   2996  c6 0c        add  a,0x0c
 *   2998  5f           ld   e,a            ; E = table[+0x0F] + 0x0C
 *   2999  eb           ex   de,hl          ; HL = the (y,x) pair
 *   299a  cd f0 2f     call 0x2ff0         ; -> HL = VRAM address
 *   299d  7e           ld   a,(hl)         ; A = tile
 *   299e  fe b0        cp   0xb0
 *   29a0  da ac 29     jp   c,0x29ac       ; tile < 0xB0 -> A=1
 *   29a3  e6 0f        and  0x0f
 *   29a5  fe 08        cp   0x08
 *   29a7  d2 ac 29     jp   nc,0x29ac      ; low nibble >= 8 -> A=1
 *   29aa  af           xor  a              ; IN RANGE -> A=0
 *   29ab  c9           ret
 *   29ac  3e 01        ld   a,0x01         ; loc_29ac
 *   29ae  c9           ret
 */
export function loc_298c(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x63c8);
  m.step(0x298f, 16); // ld hl,(0x63c8)
  regs.a = regs.l;
  m.step(0x2990, 4); // ld a,l
  regs.add(0x0e);
  m.step(0x2992, 7); // add a,0x0e
  regs.l = regs.a;
  m.step(0x2993, 4); // ld l,a -- L += 0x0E (L-only)
  regs.d = mem.read8(regs.hl);
  m.step(0x2994, 7); // ld d,(hl)
  regs.l = regs.inc8(regs.l);
  m.step(0x2995, 4); // inc l
  regs.a = mem.read8(regs.hl);
  m.step(0x2996, 7); // ld a,(hl)
  regs.add(0x0c);
  m.step(0x2998, 7); // add a,0x0c -- E = table[+0x0F] + 0x0C
  regs.e = regs.a;
  m.step(0x2999, 4); // ld e,a
  regs.exDeHl();
  m.step(0x299a, 4); // ex de,hl -- HL = the assembled (y,x)

  m.push16(0x299d); // call 0x2ff0
  m.step(0x2ff0, 17);
  m.call(0x2ff0); // translated, stack-balanced -> HL = VRAM address

  regs.a = mem.read8(regs.hl);
  m.step(0x299e, 7); // ld a,(hl) -- tile
  regs.cp(0xb0);
  m.step(0x29a0, 7); // cp 0xb0
  if (regs.fC) {
    m.step(0x29ac, 10); // jp c,0x29ac -- tile < 0xB0
    regs.a = 0x01;
    m.step(0x29ae, 7); // ld a,0x01
    m.ret(); // ret -- A=1
    return;
  }
  m.step(0x29a3, 10); // jp c not taken

  regs.and(0x0f);
  m.step(0x29a5, 7); // and 0x0f
  regs.cp(0x08);
  m.step(0x29a7, 7); // cp 0x08
  if (regs.fNC) {
    m.step(0x29ac, 10); // jp nc,0x29ac -- low nibble >= 8
    regs.a = 0x01;
    m.step(0x29ae, 7); // ld a,0x01
    m.ret(); // ret -- A=1
    return;
  }
  m.step(0x29aa, 10); // jp nc not taken

  regs.xor(regs.a); // xor a -- IN RANGE, A=0
  m.step(0x29ab, 4);
  m.ret(); // ret (0x29AB) -- A=0
}
