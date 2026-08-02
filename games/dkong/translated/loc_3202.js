// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3202  (ROM 0x3202–0x32BC) — per-object state machine; the closure hub.
 *
 * Loads the object at (0x63C8), branches on its (ix+d) state fields, dispatches
 * to EIGHT callees, does a 0x3A7A table lookup, and writes back several fields.
 * Two rets: 0x3279 (after the table lookup) and 0x327D (after call 0x32bd).
 * IX is RELOADED from (0x63C8)
 * at 0x3202/0x3246/0x3297 because the callees clobber it -- (0x63C8) is the
 * object pointer entry_31b1 maintains (its store-back). NOT a splice.
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x31CD (entry_31b1, untranslated);
 * nothing in translated src invokes loc_3202.
 *
 * TWO INTEGRATION DECISIONS:
 *  (1) entry_333d TOLERATES-EARLY-RETURN (integrator note). The
 *      call at 0x3230 is a PLAIN call. entry_333d has two hidden exits (its
 *      sub_33a1 splice and sub_236e miss), but BOTH unwind to *this* routine at
 *      0x3233 -- the exact address this call pushes -- and so does 333d's normal
 *      ret. So whether 333d finishes or bails, the machine returns to 0x3233 and
 *      this JS falls straight into `case 0x3233` (switch fall-through). No boolean
 *      guard is needed on 3202's side; 3202 just continues at 0x3233 and reads
 *      whatever object state 333d did or did not write. Decision stated per the note.
 *  (2) The other 7 callees all return NORMALLY (verified: none is skip-capable /
 *      returns a boolean), so all are plain calls. sub_298c's return A is tested
 *      by `cp 0x01 / jp z` at 0x3241 (cross-routine dispatch steer).
 *
 * HAZARDS honoured: `jp p` (0x3213/0x3238) is SIGNED -> regs.fP (bit-7-clear),
 * NOT jp nc (nmi.js loc_0e4f precedent); `add a,c` (0x3275) flags are LIVE at the
 * 0x3279 ret (S5) -> regs.add; inc/dec (ix+0x0e) (0x32A5/0x32B3) are flag-correct
 * RMW via regs.decMem8/incMem8. Irreducible CFG (backward cross-jumps) -> a
 * label-dispatch loop, ROM labels as cases, jumps as `label=X; continue`, ROM
 * fall-through as switch fall-through. Object fields / 0x3A7A table / 0x6018 not
 * interpreted.
 */
export function loc_3202(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  const ld_ix = () => { regs.ix = mem.read16(0x63c8); };
  let label = 0x3202;
  for (;;) {
    switch (label) {
      case 0x3202:
        ld_ix();
        m.step(0x3206, 20); // ld ix,(0x63c8)
        regs.a = mem.read8(R(0x18));
        m.step(0x3209, 19); // ld a,(ix+0x18)
        regs.cp(0x01);
        m.step(0x320b, 7); // cp 0x01
        if (regs.fZ) { label = 0x327a; continue; } // jp z,0x327a
        m.step(0x320e, 10); // jp z NOT taken
        regs.a = mem.read8(R(0x0d));
        m.step(0x3211, 19); // ld a,(ix+0x0d)
        regs.cp(0x04);
        m.step(0x3213, 7); // cp 0x04
        if (regs.fP) { label = 0x3230; continue; } // jp p (SIGNED) -> 0x3230
        m.step(0x3216, 10); // jp p NOT taken
        regs.a = mem.read8(R(0x19));
        m.step(0x3219, 19); // ld a,(ix+0x19)
        regs.cp(0x02);
        m.step(0x321b, 7); // cp 0x02
        if (regs.fZ) { label = 0x327e; continue; } // jp z,0x327e
        m.step(0x321e, 10); // jp z NOT taken
        m.push16(0x3221);
        m.step(0x330f, 17); // call 0x330f
        m.call(0x330f);
      // fall into 0x3221
      case 0x3221:
        regs.a = mem.read8(0x6018);
        m.step(0x3224, 13); // ld a,(0x6018)
        regs.and(0x03);
        m.step(0x3226, 7); // and 0x03
        if (regs.fNZ) { label = 0x3233; continue; } // jp nz,0x3233
        m.step(0x3229, 10); // jp nz NOT taken
      // fall into 0x3229
      case 0x3229:
        regs.a = mem.read8(R(0x0d));
        m.step(0x322c, 19); // ld a,(ix+0x0d)
        regs.and(regs.a);
        m.step(0x322d, 4); // and a
        if (regs.fZ) { label = 0x3257; continue; } // jp z,0x3257
        m.step(0x3230, 10); // jp z NOT taken
      // fall into 0x3230
      case 0x3230:
        m.push16(0x3233);
        m.step(0x333d, 17); // call 0x333d -- MAY RETURN EARLY; either way lands 0x3233
        m.call(0x333d);
      // fall into 0x3233 (3202 tolerates 333d's early return -- see header decision 1)
      case 0x3233:
        regs.a = mem.read8(R(0x0d));
        m.step(0x3236, 19); // ld a,(ix+0x0d)
        regs.cp(0x04);
        m.step(0x3238, 7); // cp 0x04
        if (regs.fP) { label = 0x3291; continue; } // jp p (SIGNED) -> 0x3291
        m.step(0x323b, 10); // jp p NOT taken
        m.push16(0x323e);
        m.step(0x33ad, 17); // call 0x33ad (falls through into entry_33c3, rets to 0x323e)
        m.call(0x33ad);
        m.push16(0x3241);
        m.step(0x298c, 17); // call 0x298c (tile-in-range predicate)
        m.call(0x298c);
        regs.cp(0x01);
        m.step(0x3243, 7); // cp 0x01 -- test 298c's return A
        if (regs.fZ) { label = 0x3297; continue; } // jp z,0x3297 (298c returned 1)
        m.step(0x3246, 10); // jp z NOT taken
        ld_ix();
        m.step(0x324a, 20); // ld ix,(0x63c8) -- RELOAD (callees clobbered IX)
        regs.a = mem.read8(R(0x0e));
        m.step(0x324d, 19); // ld a,(ix+0x0e)
        regs.cp(0x10);
        m.step(0x324f, 7); // cp 0x10
        if (regs.fC) { label = 0x328c; continue; } // jp c,0x328c ((ix+0x0e) < 0x10)
        m.step(0x3252, 10); // jp c NOT taken
        regs.cp(0xf0);
        m.step(0x3254, 7); // cp 0xf0
        if (regs.fNC) { label = 0x3284; continue; } // jp nc,0x3284 ((ix+0x0e) >= 0xf0)
        m.step(0x3257, 10); // jp nc NOT taken
      // fall into 0x3257
      case 0x3257:
        regs.a = mem.read8(R(0x13));
        m.step(0x325a, 19); // ld a,(ix+0x13)
        regs.cp(0x00);
        m.step(0x325c, 7); // cp 0x00
        if (regs.fNZ) { label = 0x32b9; continue; } // jp nz,0x32b9
        m.step(0x325f, 10); // jp nz NOT taken
        regs.a = 0x11;
        m.step(0x3261, 7); // ld a,0x11 -- default table index
      // fall into 0x3261
      case 0x3261:
        mem.write8(R(0x13), regs.a);
        m.step(0x3264, 19); // ld (ix+0x13),a
        regs.d = 0x00;
        m.step(0x3266, 7); // ld d,0x00
        regs.e = regs.a;
        m.step(0x3267, 4); // ld e,a -- DE = index
        regs.hl = 0x3a7a;
        m.step(0x326a, 10); // ld hl,0x3a7a -- table base
        regs.addHl(regs.de);
        m.step(0x326b, 11); // add hl,de
        regs.a = mem.read8(regs.hl);
        m.step(0x326c, 7); // ld a,(hl) -- table[index]
        regs.b = mem.read8(R(0x0e));
        m.step(0x326f, 19); // ld b,(ix+0x0e)
        mem.write8(R(0x03), regs.b);
        m.step(0x3272, 19); // ld (ix+0x03),b
        regs.c = mem.read8(R(0x0f));
        m.step(0x3275, 19); // ld c,(ix+0x0f)
        regs.add(regs.c);
        m.step(0x3276, 4); // add a,c -- flags LIVE at the 0x3279 ret (S5)
        mem.write8(R(0x05), regs.a);
        m.step(0x3279, 19); // ld (ix+0x05),a
        m.ret(); // 3279 EXIT
        return;
      case 0x327a:
        m.push16(0x327d);
        m.step(0x32bd, 17); // call 0x32bd
        m.call(0x32bd);
        m.ret(); // 327d EXIT -- ret passes 32bd's A/flags up
        return;
      case 0x327e:
        m.push16(0x3281);
        m.step(0x32d6, 17); // call 0x32d6
        m.call(0x32d6);
        m.step(0x3229, 10); // jp 0x3229 (backward)
        label = 0x3229;
        continue;
      case 0x3284:
        regs.a = 0x02;
        m.step(0x3286, 7); // ld a,0x02
      // fall into 0x3286
      case 0x3286:
        mem.write8(R(0x0d), regs.a);
        m.step(0x3289, 19); // ld (ix+0x0d),a
        m.step(0x3257, 10); // jp 0x3257
        label = 0x3257;
        continue;
      case 0x328c:
        regs.a = 0x01;
        m.step(0x328e, 7); // ld a,0x01
        m.step(0x3286, 10); // jp 0x3286
        label = 0x3286;
        continue;
      case 0x3291:
        m.push16(0x3294);
        m.step(0x33e7, 17); // call 0x33e7
        m.call(0x33e7);
        m.step(0x3257, 10); // jp 0x3257
        label = 0x3257;
        continue;
      case 0x3297:
        ld_ix();
        m.step(0x329b, 20); // ld ix,(0x63c8) -- RELOAD
        regs.a = mem.read8(R(0x0d));
        m.step(0x329e, 19); // ld a,(ix+0x0d)
        regs.cp(0x01);
        m.step(0x32a0, 7); // cp 0x01
        if (regs.fNZ) { label = 0x32b1; continue; } // jp nz,0x32b1
        m.step(0x32a3, 10); // jp nz NOT taken
        regs.a = 0x02;
        m.step(0x32a5, 7); // ld a,0x02
        regs.decMem8(mem, R(0x0e));
        m.step(0x32a8, 23); // dec (ix+0x0e) -- flag-correct RMW
        label = 0x32a8;
        continue;
      case 0x32a8:
        mem.write8(R(0x0d), regs.a);
        m.step(0x32ab, 19); // ld (ix+0x0d),a
        m.push16(0x32ae);
        m.step(0x33c3, 17); // call 0x33c3
        m.call(0x33c3);
        m.step(0x3257, 10); // jp 0x3257
        label = 0x3257;
        continue;
      case 0x32b1:
        regs.a = 0x01;
        m.step(0x32b3, 7); // ld a,0x01
        regs.incMem8(mem, R(0x0e));
        m.step(0x32b6, 23); // inc (ix+0x0e) -- flag-correct RMW
        m.step(0x32a8, 10); // jp 0x32a8
        label = 0x32a8;
        continue;
      case 0x32b9:
        regs.a = regs.dec8(regs.a);
        m.step(0x32ba, 4); // dec a
        m.step(0x3261, 10); // jp 0x3261 (backward)
        label = 0x3261;
        continue;
    }
  }
}
