// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_236e  (ROM 0x236E–0x239B) — cross-partition object-table search; -> A,B.
 *
 * Searches 0x6300.. for the byte in A (BC entries). cpir leaves HL = M+1 (it
 * POST-increments), and the found/not-found signal is the Z FLAG, not cpir's
 * return value (which is the iteration count n). On a hit, a secondary compare
 * of D against two slots selects which of them is returned in B:
 *
 *   M = the matched address.
 *   D == (M+0x15)   ->  A = 1, B = (M+0x2A)     [loc_238f]   ** the OTHER slot **
 *   D == (M+0x2A)   ->  A = 0, B = (M+0x15)     [loc_2395]   ** the OTHER slot **
 *   neither         ->  restore D:=A, A:=key and re-search from M+1  [jp 0x2371]
 *   cpir found none ->  UNWIND (see the header) -- returns false, no A/B contract
 *
 * cpir cost is 21 T per iteration except the last (16 T) => 21*(n-1) + 16, NOT a
 * constant; cpir(mem) returns n precisely so this can be charged.
 *
 * `xor a` at 0x2395 does DOUBLE DUTY: A=0 (the return value) AND it CLEARS THE
 * CARRY that `sbc hl,bc` at 0x2396 subtracts. Writing `regs.a = 0` gets the
 * return value right and the address wrong whenever carry is set.
 *
 * @returns {boolean} true when control returned NORMALLY; false when the miss
 *   path unwound to the caller's caller.
 */
export function sub_236e(m) {
  const { regs, mem } = m;

  regs.hl = 0x6300;
  m.step(0x2371, 10); // ld hl,0x6300

  for (;;) {
    const n = regs.cpir(mem); // leaves HL = M+1; Z set iff a byte matched
    m.step(0x2373, 21 * (n - 1) + 16); // cpir -- NOT a constant (first-use cost)
    if (regs.fNZ) {
      // loc_239a, THE MISS PATH: `pop hl` at 0x239A with NOTHING pushed.
      m.step(0x239a, 10); // jp nz,0x239a (taken)
      regs.hl = m.pop16(); // pop hl -- discards this routine's return address
      m.step(0x239b, 10); // (the pop hl cost)
      m.ret(); // ret -- pops the CALLER's return address, unwinds a second frame
      return false;
    }
    m.step(0x2376, 10); // jp nz,0x239a (not taken)

    m.push16(regs.hl);
    m.step(0x2377, 11); // push hl
    m.push16(regs.bc);
    m.step(0x2378, 11); // push bc
    regs.bc = 0x0014;
    m.step(0x237b, 10); // ld bc,0x0014
    regs.addHl(regs.bc); // HL = M+0x15
    m.step(0x237c, 11); // add hl,bc
    regs.c = regs.inc8(regs.c); // BC -> 0x0015. `inc c`, NOT `inc bc`
    m.step(0x237d, 4); // inc c
    regs.e = regs.a; // E = the search key, saved for the retry
    m.step(0x237e, 4); // ld e,a
    regs.a = regs.d; // A = D. D itself is never modified by this routine
    m.step(0x237f, 4); // ld a,d
    regs.cp(mem.read8(regs.hl)); // D vs (M+0x15)
    m.step(0x2380, 7); // cp (hl)

    if (regs.fZ) {
      // loc_238f -- first candidate matched
      m.step(0x238f, 10); // jp z,0x238f (taken)
      regs.addHl(regs.bc); // HL = M+0x2A
      m.step(0x2390, 11); // add hl,bc
      regs.a = 0x01;
      m.step(0x2392, 7); // ld a,0x01
      m.step(0x2398, 10); // jp 0x2398
      return tail2398(m);
    }
    m.step(0x2383, 10); // jp z,0x238f (not taken)

    regs.addHl(regs.bc); // HL = M+0x2A
    m.step(0x2384, 11); // add hl,bc
    regs.cp(mem.read8(regs.hl)); // D vs (M+0x2A)
    m.step(0x2385, 7); // cp (hl)

    if (regs.fZ) {
      // loc_2395 -- second candidate matched
      m.step(0x2395, 10); // jp z,0x2395 (taken)
      regs.xor(regs.a); // A = 0 AND CARRY CLEARED -- the sbc below needs it
      m.step(0x2396, 4); // xor a
      regs.sbcHl(regs.bc); // HL = M+0x2A - 0x15 = M+0x15. sbcHl ASSIGNS this.hl
      m.step(0x2398, 15); //   and returns nothing -- do NOT write `regs.hl = ...`
      return tail2398(m); // sbc hl,bc
    }
    m.step(0x2388, 10); // jp z,0x2395 (not taken)

    regs.d = regs.a; // writes D back UNCHANGED (A was loaded from D at 0x237E)
    m.step(0x2389, 4); // ld d,a
    regs.a = regs.e; // restore the search key
    m.step(0x238a, 4); // ld a,e
    regs.bc = m.pop16();
    m.step(0x238b, 10); // pop bc
    regs.hl = m.pop16(); // back to M+1 -- the retry resumes AFTER the match
    m.step(0x238c, 10); // pop hl
    m.step(0x2371, 10); // jp 0x2371 -- re-search
  }
}

/**
 * tail2398  (ROM 0x2398–0x239B) — 0x239B -- the FOUND tail, reached from both hit paths. NOT the same.
 * tail as the miss path: it does `pop bc` and `ld b,(hl)` FIRST, and only then
 * falls into 0x239A's `pop hl`. The miss path enters at 0x239A and does neither
 * (see sub_236e's header). Module-local because both hit paths converge on it,
 * mirroring the ROM's shared 0x2398 tail.
 */
export function tail2398(m) {
  const { regs, mem } = m;
  regs.bc = m.pop16(); // restores the caller's BC...
  m.step(0x2399, 10); // pop bc
  regs.b = mem.read8(regs.hl); // ...then immediately overwrites B. C survives.
  m.step(0x239a, 7); // ld b,(hl)
  regs.hl = m.pop16(); // balances the push at 0x2376 -- HL = M+1
  m.step(0x239b, 10); // pop hl
  m.ret(10); // ret
  return true;
}
