// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1468  (ROM 0x1468-0x1490) — the "(L & 0x0c) != 0" arm of the mode-idle
 * object dispatcher, entered from loc_144c via `jr nz,0x1468` with the selected
 * object byte still in L. It reconciles the phase byte at 0x801a against L:
 *
 *   read A = mem[0x801a]
 *   if A == L                 -> loc_1468_disp (dispatch on L bit2)
 *   else if A == 0            -> seed mem[0x801a] = L | 0xc0, then loc_1468_disp
 *   else                      -> loc_1468_adj  (step the phase down by 0x20)
 *
 * loc_1468_adj (0x1479): A -= 0x20, store to 0x801a, mask A & 0x0c and compare
 * to L; either way it tail-jumps to 0x1b5b (defer the frame), first storing L
 * into 0x801a when the masked value does NOT match L.
 *
 * loc_1468_disp (0x148b): tests L bit2 -> jp nz 0x186a, else jp 0x1a02.
 *
 * The two internal labels (0x1479, 0x148b) are reached ONLY from inside this
 * routine, so they are modelled as parent-suffixed helpers called directly
 * (`return loc_1468_adj(m)` / `return loc_1468_disp(m)`), never registered at
 * their own address. Every real exit is a tail-jump — `return m.call(target)`
 * whose callee ret returns to OUR caller, so there is no trailing m.ret.
 *
 *   1468  3a 1a 80     ld   a,(0x801a)
 *   146b  bd           cp   l
 *   146c  28 1d        jr   z,0x148b
 *   146e  a7           and  a
 *   146f  20 08        jr   nz,0x1479
 *   1471  7d           ld   a,l
 *   1472  f6 c0        or   0xc0
 *   1474  32 1a 80     ld   (0x801a),a
 *   1477  18 12        jr   0x148b
 * loc_1479:
 *   1479  d6 20        sub  0x20
 *   147b  32 1a 80     ld   (0x801a),a
 *   147e  e6 0c        and  0x0c
 *   1480  bd           cp   l
 *   1481  ca 5b 1b     jp   z,0x1b5b
 *   1484  7d           ld   a,l
 *   1485  32 1a 80     ld   (0x801a),a
 *   1488  c3 5b 1b     jp   0x1b5b
 * loc_148b:
 *   148b  cb 55        bit  2,l
 *   148d  c2 6a 18     jp   nz,0x186a
 *   1490  c3 02 1a     jp   0x1a02
 */
export function loc_1468(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x801a);
  m.step(0x146b, 13); // ld a,(0x801a) -- the phase byte for this object
  regs.cp(regs.l);
  m.step(0x146c, 4); // cp l -- phase already equal to the object byte?
  if (regs.fZ) {
    m.step(0x148b, 12); // jr z taken -- already settled, go dispatch
    return loc_1468_disp(m);
  }
  m.step(0x146e, 7); // jr z not taken

  regs.and(regs.a);
  m.step(0x146f, 4); // and a -- test the phase byte (A still == mem[0x801a])
  if (regs.fNZ) {
    m.step(0x1479, 12); // jr nz taken -- phase non-zero, step it down
    return loc_1468_adj(m);
  }
  m.step(0x1471, 7); // jr nz not taken -- phase was 0, seed it

  regs.a = regs.l;
  m.step(0x1472, 4); // ld a,l
  regs.or(0xc0);
  m.step(0x1474, 7); // or 0xc0 -- seed value = L | 0xc0
  mem.write8(0x801a, regs.a);
  m.step(0x1477, 13); // ld (0x801a),a
  m.step(0x148b, 12); // jr 0x148b -- fall into the dispatch
  return loc_1468_disp(m);
}

/**
 * loc_1468_adj  (ROM 0x1479-0x1488) — the phase-non-zero arm: A -= 0x20, write
 * it back to 0x801a, then compare (A & 0x0c) to L. When they match, defer to
 * 0x1b5b directly; otherwise overwrite 0x801a with L first, then defer to
 * 0x1b5b. Both exits tail-jump to 0x1b5b.
 */
export function loc_1468_adj(m) {
  const { regs, mem } = m;

  regs.sub(0x20);
  m.step(0x147b, 7); // sub 0x20 -- step the phase down by one increment
  mem.write8(0x801a, regs.a);
  m.step(0x147e, 13); // ld (0x801a),a
  regs.and(0x0c);
  m.step(0x1480, 7); // and 0x0c -- isolate the low phase bits
  regs.cp(regs.l);
  m.step(0x1481, 4); // cp l -- masked phase back to the object byte?
  if (regs.fZ) {
    m.step(0x1b5b, 10); // jp z taken -- matched, defer the frame
    return m.call(0x1b5b);
  }
  m.step(0x1484, 10); // jp z not taken

  regs.a = regs.l;
  m.step(0x1485, 4); // ld a,l
  mem.write8(0x801a, regs.a);
  m.step(0x1488, 13); // ld (0x801a),a -- snap the phase to L
  m.step(0x1b5b, 10); // jp 0x1b5b -- defer the frame
  return m.call(0x1b5b);
}

/**
 * loc_1468_disp  (ROM 0x148b-0x1490) — the settled-phase dispatch: test L bit2
 * and tail-jump to 0x186a when set, else 0x1a02.
 */
export function loc_1468_disp(m) {
  const { regs } = m;

  regs.bit(2, regs.l);
  m.step(0x148d, 8); // bit 2,l
  if (regs.fNZ) {
    m.step(0x186a, 10); // jp nz taken -- L bit2 set
    return m.call(0x186a);
  }
  m.step(0x1490, 10); // jp nz not taken

  m.step(0x1a02, 10); // jp 0x1a02
  return m.call(0x1a02);
}
