// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_467b  (ROM 0x467b-0x4682) — score-add entry point (+10). One of a family
 * of thin entry points (sub_4673 +1, sub_467b +10, sub_4683 +20) that each fire
 * a sound effect and then tail-jump into the shared BCD adder sub_4689 with the
 * increment preloaded in BC. This one triggers sound id 0x10 (call 0x4c8f) and
 * requests a +0x0010 (BCD) bump of the two-byte score at 0x8031/0x8034.
 *
 *   467b  cd 8f 4c     call 0x4c8f      ; sound effect 0x10
 *   467e  01 10 00     ld   bc,0x0010   ; BCD score increment
 *   4681  18 06        jr   0x4689      ; tail-jump into the shared adder
 *
 * The terminal `jr 0x4689` pushes nothing, so sub_4689's own `ret` (whether the
 * skip `ret` at 0x4672 via its `jr nc` or the `ret` at 0x46f3) returns to OUR
 * caller. It is modelled `m.step(0x4689,12); return m.call(0x4689)` — NOT the
 * `m.call(); m.ret()` shape, which would pop a spurious word off the stack and
 * charge a second ret (the double-pop trap the sub_3d8a header calls out).
 *
 * sub_467b's OWN three instructions touch no flags: a CALL, an LD BC,nn, and a
 * JR are all flag-neutral (the callees change flags, but that is their business).
 */
export function sub_467b(m) {
  const { regs } = m;

  m.push16(0x467e);
  m.step(0x4c8f, 17); // 467b  call 0x4c8f -- sound effect 0x10
  m.call(0x4c8f);

  regs.bc = 0x0010;
  m.step(0x4681, 10); // 467e  ld bc,0x0010 -- BCD score increment (+10)

  // 4681  jr 0x4689 -- tail-jump; sub_4689's ret returns to OUR caller.
  m.step(0x4689, 12);
  return m.call(0x4689);
}
