// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0278  (ROM 0x0278-0x02a0, The Pit) — guards on the mode/count byte
 * (0x8001), decrements the counter (0x802b), calls 0x4632, then dispatches by
 * whether (0x8001)==1. Every exit is a JUMP, not a ret: this routine has NO ret.
 *
 *   - (0x8001) >= 3  -> tail-jump loc_03ac (bail before touching anything).
 *   - else decrement (0x802b), `call 0x4632` (this one RETURNS and continues),
 *     reload (0x8001) and `dec a`:
 *       - (0x8001) != 1 -> tail-jump loc_02a1.
 *       - (0x8001) == 1 -> A is now 0: store (0x802d)=0, set (0x8002)=1, load
 *         (0x802c); if (0x802c)!=0 tail-jump loc_02ca else tail-jump loc_0371.
 *
 * `call 0x4632` at 0x0287 is an ordinary call: it is modelled push16(ret) +
 * m.step(target,17) + m.call, and control falls through to 0x028a afterwards.
 * The four branch exits (loc_03ac / loc_02a1 / loc_02ca / loc_0371) are
 * TAIL-JUMPS — their own `ret` returns to OUR caller — so each is modelled per
 * the thepit convention (loc_02a1 / loc_4b40) as `m.step(target,T); return
 * m.call(target)` with no trailing m.ret (a call+ret would push a spurious frame
 * and double-pop). loc_02a1/loc_02ca/loc_0371/loc_03ac are all shared entries in
 * their own right, so none is inlined here. `cp 0x03` sets C iff (0x8001)<3, so
 * `jp nc` bails when (0x8001)>=3. `and a` is the (0x802c)==0 test. Work-RAM
 * stores take no bus offset.
 *
 *   0278  3a 01 80     ld   a,(0x8001)
 *   027b  fe 03        cp   0x03
 *   027d  d2 ac 03     jp   nc,0x03ac
 *   0280  3a 2b 80     ld   a,(0x802b)
 *   0283  3d           dec  a
 *   0284  32 2b 80     ld   (0x802b),a
 *   0287  cd 32 46     call 0x4632
 *   028a  3a 01 80     ld   a,(0x8001)
 *   028d  3d           dec  a
 *   028e  20 11        jr   nz,0x02a1
 *   0290  32 2d 80     ld   (0x802d),a
 *   0293  3c           inc  a
 *   0294  32 02 80     ld   (0x8002),a
 *   0297  3a 2c 80     ld   a,(0x802c)
 *   029a  a7           and  a
 *   029b  c2 ca 02     jp   nz,0x02ca
 *   029e  c3 71 03     jp   0x0371
 */
export function loc_0278(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8001);
  m.step(0x027b, 13); // 0278  ld a,(0x8001) -- the mode/count byte

  regs.cp(0x03);
  m.step(0x027d, 7); // 027b  cp 0x03 -- C set iff (0x8001) < 3

  // 027d  jp nc,0x03ac -- (0x8001) >= 3 bails to loc_03ac (tail-jump)
  if (regs.fNC) {
    m.step(0x03ac, 10); // jp taken; loc_03ac's ret returns to OUR caller
    return m.call(0x03ac);
  }
  m.step(0x0280, 10); // jp nc NOT taken -- (0x8001) < 3, continue

  regs.a = mem.read8(0x802b);
  m.step(0x0283, 13); // 0280  ld a,(0x802b)

  regs.a = regs.dec8(regs.a);
  m.step(0x0284, 4); // 0283  dec a -- counter (0x802b)--

  mem.write8(0x802b, regs.a);
  m.step(0x0287, 13); // 0284  ld (0x802b),a

  m.push16(0x028a);
  m.step(0x4632, 17); // 0287  call 0x4632 -- ordinary call, returns to 0x028a
  m.call(0x4632);

  regs.a = mem.read8(0x8001);
  m.step(0x028d, 13); // 028a  ld a,(0x8001) -- reload the mode/count byte

  regs.a = regs.dec8(regs.a);
  m.step(0x028e, 4); // 028d  dec a -- Z set iff (0x8001)==1

  // 028e  jr nz,0x02a1 -- (0x8001)!=1 tail-jumps to loc_02a1
  if (regs.fNZ) {
    m.step(0x02a1, 12); // jr taken; loc_02a1's ret returns to OUR caller
    return m.call(0x02a1);
  }
  m.step(0x0290, 7); // jr nz NOT taken -- (0x8001)==1, A is now 0

  mem.write8(0x802d, regs.a); // (0x802d) = 0
  m.step(0x0293, 13); // 0290  ld (0x802d),a

  regs.a = regs.inc8(regs.a); // A: 0 -> 1
  m.step(0x0294, 4); // 0293  inc a

  mem.write8(0x8002, regs.a); // (0x8002) = 1
  m.step(0x0297, 13); // 0294  ld (0x8002),a

  regs.a = mem.read8(0x802c);
  m.step(0x029a, 13); // 0297  ld a,(0x802c)

  regs.and(regs.a); // and a -- Z set iff (0x802c)==0
  m.step(0x029b, 4); // 029a  and a

  // 029b  jp nz,0x02ca -- (0x802c)!=0 tail-jumps to loc_02ca
  if (regs.fNZ) {
    m.step(0x02ca, 10); // jp taken; tail-jump
    return m.call(0x02ca);
  }
  m.step(0x029e, 10); // jp nz NOT taken -- (0x802c)==0, fall to the jp

  // 029e  jp 0x0371 -- unconditional tail-jump to loc_0371
  m.step(0x0371, 10);
  return m.call(0x0371);
}
