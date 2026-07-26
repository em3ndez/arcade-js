// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_022d  (ROM 0x022d-0x0277, The Pit) — per-round initialisation: reset the
 * stack, run six setup subroutines, seed a handful of round-state bytes, prime
 * the two player slots through 0x4632, then FALL THROUGH into the main round
 * loop at loc_0278.
 *
 *   022d  31 ff 83     ld   sp,0x83ff      ; stack top = end of work RAM
 *   0230  3e 00        ld   a,0x00
 *   0232  32 48 80     ld   (0x8048),a     ; clear 0x8048
 *   0235  cd 14 4b     call 0x4b14
 *   0238  cd 4d 4c     call 0x4c4d
 *   023b  cd 44 4b     call 0x4b44
 *   023e  cd 5f 4c     call 0x4c5f
 *   0241  cd ea 4b     call 0x4bea
 *   0244  cd 55 4b     call 0x4b55
 *   0247  3a 4e 80     ld   a,(0x804e)
 *   024a  32 11 80     ld   (0x8011),a     ; 0x804e -> 0x8011
 *   024d  3e 01        ld   a,0x01
 *   024f  32 28 80     ld   (0x8028),a     ; 0x8028 = 1
 *   0252  3a 53 80     ld   a,(0x8053)
 *   0255  32 2b 80     ld   (0x802b),a     ; 0x8053 -> 0x802b
 *   0258  3e 01        ld   a,0x01
 *   025a  32 02 80     ld   (0x8002),a     ; 0x8002 = 1
 *   025d  cd 32 46     call 0x4632         ; prime player slot (mode 1)
 *   0260  3e 02        ld   a,0x02
 *   0262  32 02 80     ld   (0x8002),a     ; 0x8002 = 2
 *   0265  cd 32 46     call 0x4632         ; prime player slot (mode 2)
 *   0268  3a 01 80     ld   a,(0x8001)
 *   026b  32 02 80     ld   (0x8002),a     ; 0x8002 = (0x8001)
 *   026e  cd 44 46     call 0x4644
 *   0271  3a 2b 80     ld   a,(0x802b)
 *   0274  3c           inc  a
 *   0275  32 2b 80     ld   (0x802b),a     ; 0x802b++
 *                       ; --- falls through into loc_0278 ---
 *
 * FALL-THROUGH, NOT A RET. The block ends at 0x0275 and execution continues
 * straight into loc_0278 (0x0278) — which is a real routine of its own (it is an
 * external jump target: `jp z,0x0278` at 0x13d8 and 0x345f). Modelled the way the
 * oracle models any tail transfer that discards nothing: after the last
 * instruction's m.step lands PC on 0x0278, `return m.call(0x0278)` so loc_0278's
 * own control flow (its eventual ret) propagates back to loc_022d's caller
 * unchanged. There is NO jump instruction here, so NO extra T-states are charged
 * for the fall-through — unlike loc_0000's `jp` (which charges its 10 T first).
 *
 * Every `call` is `m.push16(returnAddr) / m.step(target,17) / m.call(target)`:
 * the push and the 17-T `call nn` cost sit at the call site; only the invocation
 * goes through the registry seam. The callees charge their own T-states.
 */
export function loc_022d(m) {
  const { regs, mem } = m;

  regs.sp = 0x83ff;
  m.step(0x0230, 10); // 022d  ld sp,0x83ff

  regs.a = 0x00;
  m.step(0x0232, 7); // 0230  ld a,0x00

  mem.write8(0x8048, regs.a);
  m.step(0x0235, 13); // 0232  ld (0x8048),a

  m.push16(0x0238);
  m.step(0x4b14, 17); // 0235  call 0x4b14
  m.call(0x4b14);

  m.push16(0x023b);
  m.step(0x4c4d, 17); // 0238  call 0x4c4d
  m.call(0x4c4d);

  m.push16(0x023e);
  m.step(0x4b44, 17); // 023b  call 0x4b44
  m.call(0x4b44);

  m.push16(0x0241);
  m.step(0x4c5f, 17); // 023e  call 0x4c5f
  m.call(0x4c5f);

  m.push16(0x0244);
  m.step(0x4bea, 17); // 0241  call 0x4bea
  m.call(0x4bea);

  m.push16(0x0247);
  m.step(0x4b55, 17); // 0244  call 0x4b55
  m.call(0x4b55);

  regs.a = mem.read8(0x804e);
  m.step(0x024a, 13); // 0247  ld a,(0x804e)

  mem.write8(0x8011, regs.a);
  m.step(0x024d, 13); // 024a  ld (0x8011),a

  regs.a = 0x01;
  m.step(0x024f, 7); // 024d  ld a,0x01

  mem.write8(0x8028, regs.a);
  m.step(0x0252, 13); // 024f  ld (0x8028),a

  regs.a = mem.read8(0x8053);
  m.step(0x0255, 13); // 0252  ld a,(0x8053)

  mem.write8(0x802b, regs.a);
  m.step(0x0258, 13); // 0255  ld (0x802b),a

  regs.a = 0x01;
  m.step(0x025a, 7); // 0258  ld a,0x01

  mem.write8(0x8002, regs.a);
  m.step(0x025d, 13); // 025a  ld (0x8002),a

  m.push16(0x0260);
  m.step(0x4632, 17); // 025d  call 0x4632
  m.call(0x4632);

  regs.a = 0x02;
  m.step(0x0262, 7); // 0260  ld a,0x02

  mem.write8(0x8002, regs.a);
  m.step(0x0265, 13); // 0262  ld (0x8002),a

  m.push16(0x0268);
  m.step(0x4632, 17); // 0265  call 0x4632
  m.call(0x4632);

  regs.a = mem.read8(0x8001);
  m.step(0x026b, 13); // 0268  ld a,(0x8001)

  mem.write8(0x8002, regs.a);
  m.step(0x026e, 13); // 026b  ld (0x8002),a

  m.push16(0x0271);
  m.step(0x4644, 17); // 026e  call 0x4644
  m.call(0x4644);

  regs.a = mem.read8(0x802b);
  m.step(0x0274, 13); // 0271  ld a,(0x802b)

  regs.a = regs.inc8(regs.a);
  m.step(0x0275, 4); // 0274  inc a -- flags set (carry preserved); dead before loc_0278

  mem.write8(0x802b, regs.a);
  m.step(0x0278, 13); // 0275  ld (0x802b),a -- PC now at 0x0278

  // Fall-through into loc_0278 (main round loop). No jump instruction => no extra
  // T-states; loc_0278's ret returns to loc_022d's caller.
  return m.call(0x0278);
}
