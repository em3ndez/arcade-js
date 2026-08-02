// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_306f  (ROM 0x306F–0x3095) — 39 bytes, 19 instructions.
 *
 *   306f  21 af 62     ld   hl,0x62af
 *   3072  34           inc  (hl)
 *   3073  7e           ld   a,(hl)
 *   3074  e6 07        and  0x07
 *   3076  c0           ret  nz
 *   3077  21 0b 69     ld   hl,0x690b
 *   307a  0e fc        ld   c,0xfc
 *   307c  ff           rst  0x38        ; = call 0x0038 (loc_0038), NOT a skip
 *   307d  0e 81        ld   c,0x81
 *   307f  21 09 69     ld   hl,0x6909
 *   3082  cd 96 30     call 0x3096
 *   3085  21 1d 69     ld   hl,0x691d
 *   3088  cd 96 30     call 0x3096
 *   308b  cd 57 00     call 0x0057
 *   308e  e6 80        and  0x80
 *   3090  21 2d 69     ld   hl,0x692d
 *   3093  ae           xor  (hl)
 *   3094  77           ld   (hl),a
 *   3095  c9           ret
 *
 *
 * Callers 0x0AE8/0x1732/0x1757 are untranslated, and
 * nothing in translated src invokes loc_306f.
 *
 * EVERY-8TH-CALL GATE: `inc (hl)` bumps the counter at 0x62AF, and
 * `ret nz` after `and 0x07` returns on 7 of every 8 calls. The body (0x3077+)
 * runs only when the counter is a multiple of 8. `ret nz` FALLS THROUGH on Z --
 * stated, not assumed terminal (the drafter-contract's named defect class).
 *
 * `rst 0x38` (0x307C) is a PLAIN CALL into loc_0038, NOT the conditional-skip
 * semantics of rst 0x08/0x10. Modelled exactly as the existing
 * rst 0x38 site at nmi.js (push the return, step 11 T to 0x0038, call the
 * handler whose `ret` pops it) -- the same ld hl,0x690b / ld c,0xfc setup even
 * appears there.
 *
 * DE IS NEVER SET IN THIS ROUTINE. sub_3096's stride comes from
 * loc_0038's `ld de,0x0004` SIDE EFFECT: loc_0038 sets DE=0x0004, and neither
 * sub_003d (loc_0038's loop) nor sub_3096 writes DE, so DE=0x0004 survives from
 * the rst into both `call 0x3096`. Load-bearing and invisible -- reordering the
 * rst after the calls, or a loc_0038 that dropped the DE write, would break the
 * stride with nothing red in loc_306f. Verified against loc_0038's body.
 *
 * C is reloaded across the rst deliberately: 0xFC (=-4) is the addend
 * loc_0038 subtracts; 0x81 is the XOR mask sub_3096 applies. loc_0038 reads C
 * but never writes it, so the reload is a genuine operand change, not a restore.
 *
 * `call 0x0057` returns the pseudo-random sum in A; `and 0x80` keeps bit 7, and
 * `xor (hl) / ld (hl),a` toggles bit 7 of 0x692D on it. `xor (hl)`
 * is a RMW of the existing byte (like sub_3096). Both exits leave live flags:
 * the `ret nz` hands back `and 0x07`'s, the `ret` `xor (hl)`'s.
 */
export function loc_306f(m) {
  const { regs, mem } = m;

  regs.hl = 0x62af;
  m.step(0x3072, 10); // ld hl,0x62af
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- counter++, inc8 preserves carry
  m.step(0x3073, 11); // inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x3074, 7); // ld a,(hl)
  regs.and(0x07);
  m.step(0x3076, 7); // and 0x07
  if (regs.fNZ) {
    m.ret(11); // ret nz -- 7 of every 8 calls exit here
    return;
  }
  m.step(0x3077, 5); // ret nz NOT taken -- fall through

  regs.hl = 0x690b;
  m.step(0x307a, 10); // ld hl,0x690b
  regs.c = 0xfc; // -4: loc_0038 subtracts 4 from each of 10 bytes
  m.step(0x307c, 7); // ld c,0xfc

  // rst 0x38 -- a real CALL to loc_0038 (push the return, ret pops it), NOT a
  // skip. loc_0038 sets DE=0x0004 as the side effect the sub_3096 calls need.
  m.push16(0x307d);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038); // sets DE=0x0004; leaves it (sub_003d only reads DE)

  regs.c = 0x81; // XOR mask for the two sub_3096 calls
  m.step(0x307f, 7); // ld c,0x81
  regs.hl = 0x6909;
  m.step(0x3082, 10); // ld hl,0x6909
  m.push16(0x3085);
  m.step(0x3096, 17); // call 0x3096
  m.call(0x3096); // DE=0x0004 from the rst; preserves DE and C

  regs.hl = 0x691d;
  m.step(0x3088, 10); // ld hl,0x691d
  m.push16(0x308b);
  m.step(0x3096, 17); // call 0x3096
  m.call(0x3096); // DE still 0x0004 from the rst

  m.push16(0x308e);
  m.step(0x0057, 17); // call 0x0057
  m.call(0x0057); // A = (0x6018)+(0x601A)+(0x6019), written back to 0x6018

  regs.and(0x80); // keep bit 7 of the sum
  m.step(0x3090, 7); // and 0x80
  regs.hl = 0x692d;
  m.step(0x3093, 10); // ld hl,0x692d
  regs.xor(mem.read8(regs.hl)); // xor (hl) -- RMW, toggle bit 7 of 0x692D
  m.step(0x3094, 7); // xor (hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x3095, 7); // ld (hl),a

  m.ret(); // 3095 -- xor (hl) flags escape to the caller
}
