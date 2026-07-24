// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_306f — hand-optimized rewrite of the translated routine at ROM 0x306F,
 * proven equal to its oracle by the equivalence harness. It touches sprite-animation work
 * RAM (counter 0x62AF, sprite fields 0x6909/0x690B/0x691D/0x692D) that lacks settled ram.js
 * names, so those stay hex.
 */

/**
 * sub_306f -- every-8th-frame sprite animation tick.  [ROM 0x306F-0x3095]
 *
 * Three callers. It bumps the frame counter at 0x62AF every call and returns early on 7 of
 * every 8 (the `and 0x07` gate). On the 8th:
 *   - rst 0x38 subtracts 4 from each of 10 bytes at 0x690B (C=0xFC), and leaves DE=0x0004
 *     as the side effect the two sub_3096 calls consume,
 *   - sub_3096 twice (mask C=0x81) toggles fields at 0x6909 and 0x691D,
 *   - sub_0057 folds the PRNG (A = 0x6018+0x601A+0x6019, written back to 0x6018),
 *   - bit 7 of that sum XOR-toggles bit 7 of 0x692D (a sprite mirror/attribute).
 * The `xor (hl)` flags at 0x3094 escape through the `ret`.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the straight-line runs between
 * branch/call boundaries folded into a single charge each; every m.call(0xADDR) and
 * its push16/step call-scaffolding is left exactly as the oracle emits it, since
 * that's a routine boundary, not foldable). No hardware-bus write occurs here
 * (0x62AF/0x690B.../0x692D are all work RAM), so nothing else pins a boundary.
 * Branch totals: ret-nz (7-of-8 skip) 46 t; the 8th-call path's own charges (i.e.
 * excluding the three callees' opaque internal cycles) sum to 187 t -- both EXACTLY
 * the oracle's, verified against the per-instruction sums above term by term.
 */
export function sub_306f(m) {
  const { regs, mem } = m;

  // Block A: inc the frame counter, test the every-8th gate.  10+11+7+7 = 35 t
  regs.hl = 0x62af;
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- counter++, inc8 preserves carry
  regs.a = mem.read8(regs.hl);
  regs.and(0x07);
  m.step(0x3076, 35);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- 7 of every 8 calls exit here (branch total 46 t)
    return;
  }

  // Block B: (jr not taken 5) + set up the rst 0x38 call args.  5+10+7 = 22 t
  regs.hl = 0x690b;
  regs.c = 0xfc; // -4: loc_0038 subtracts 4 from each of 10 bytes
  m.step(0x307c, 22);
  // rst 0x38 -- a real CALL to loc_0038; sets DE=0x0004 as a side effect.
  m.push16(0x307d);
  m.step(0x0038, 11);
  m.call(0x0038);

  // Block C: set up the first sub_3096 call args.  7+10 = 17 t
  regs.c = 0x81; // XOR mask for the two sub_3096 calls
  regs.hl = 0x6909;
  m.step(0x3082, 17);
  m.push16(0x3085);
  m.step(0x3096, 17);
  m.call(0x3096); // DE=0x0004 from the rst; preserves DE and C

  // single-instruction block: set up the second sub_3096 call args.  10 t
  regs.hl = 0x691d;
  m.step(0x3088, 10);
  m.push16(0x308b);
  m.step(0x3096, 17);
  m.call(0x3096); // DE still 0x0004 from the rst

  m.push16(0x308e);
  m.step(0x0057, 17);
  m.call(0x0057); // A = (0x6018)+(0x601A)+(0x6019), written back to 0x6018

  // Block E: keep bit 7 of the PRNG sum, toggle it into 0x692D.  7+10+7+7 = 31 t
  regs.and(0x80); // keep bit 7 of the sum
  regs.hl = 0x692d;
  regs.xor(mem.read8(regs.hl)); // xor (hl) -- toggle bit 7 of 0x692D
  mem.write8(regs.hl, regs.a);
  m.step(0x3095, 31);

  m.ret(); // 0x3095 -- xor (hl) flags escape to the caller
}
