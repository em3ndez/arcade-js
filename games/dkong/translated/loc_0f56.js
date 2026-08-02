// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * loc_0f56  (ROM 0x0F56–0x0FCA) — , tail at 0x0FCB flagged and NOT translated.
 *
 *   0f56  06 27        ld   b,0x27
 *   0f58  21 00 62     ld   hl,0x6200
 *   0f5b  af           xor  a
 * loc_0f5c:
 *   0f5c  77           ld   (hl),a
 *   0f5d  2c           inc  l
 *   0f5e  10 fc        djnz 0x0f5c
 *   0f60  0e 11        ld   c,0x11
 *   0f62  16 80        ld   d,0x80
 *   0f64  21 80 62     ld   hl,0x6280
 * loc_0f67:
 *   0f67  42           ld   b,d
 * loc_0f68:
 *   0f68  77           ld   (hl),a
 *   0f69  23           inc  hl
 *   0f6a  10 fc        djnz 0x0f68
 *   0f6c  0d           dec  c
 *   0f6d  20 f8        jr   nz,0x0f67
 *   0f6f  21 9c 3d     ld   hl,0x3d9c
 *   0f72  11 80 62     ld   de,0x6280
 *   0f75  01 40 00     ld   bc,0x0040
 *   0f78  ed b0        ldir
 *   0f7a  3a 29 62     ld   a,(0x6229)
 *   0f7d  47           ld   b,a
 *   0f7e  a7           and  a
 *   0f7f  17           rla
 *   0f80  a7           and  a
 *   0f81  17           rla
 *   0f82  a7           and  a
 *   0f83  17           rla
 *   0f84  80           add  a,b
 *   0f85  80           add  a,b
 *   0f86  c6 28        add  a,0x28
 *   0f88  fe 51        cp   0x51
 *   0f8a  38 02        jr   c,0x0f8e
 *   0f8c  3e 50        ld   a,0x50
 * loc_0f8e:
 *   0f8e  21 b0 62     ld   hl,0x62b0
 *   0f91  06 03        ld   b,0x03
 * loc_0f93:
 *   0f93  77           ld   (hl),a
 *   0f94  2c           inc  l
 *   0f95  10 fc        djnz 0x0f93
 *   0f97  87           add  a,a
 *   0f98  47           ld   b,a
 *   0f99  3e dc        ld   a,0xdc
 *   0f9b  90           sub  b
 *   0f9c  fe 28        cp   0x28
 *   0f9e  30 02        jr   nc,0x0fa2
 *   0fa0  3e 28        ld   a,0x28
 * loc_0fa2:
 *   0fa2  77           ld   (hl),a
 *   0fa3  2c           inc  l
 *   0fa4  77           ld   (hl),a
 *   0fa5  21 09 62     ld   hl,0x6209
 *   0fa8  36 04        ld   (hl),0x04
 *   0faa  2c           inc  l
 *   0fab  36 08        ld   (hl),0x08
 *   0fad  3a 27 62     ld   a,(0x6227)
 *   0fb0  4f           ld   c,a
 *   0fb1  cb 57        bit  2,a
 *   0fb3  20 16        jr   nz,0x0fcb
 *   0fb5  21 00 6a     ld   hl,0x6a00
 *   0fb8  3e 4f        ld   a,0x4f
 *   0fba  06 03        ld   b,0x03
 * loc_0fbc:
 *   0fbc  77           ld   (hl),a
 *   0fbd  2c           inc  l
 *   0fbe  36 3a        ld   (hl),0x3a
 *   0fc0  2c           inc  l
 *   0fc1  36 0f        ld   (hl),0x0f
 *   0fc3  2c           inc  l
 *   0fc4  36 18        ld   (hl),0x18
 *   0fc6  2c           inc  l
 *   0fc7  c6 10        add  a,0x10
 *   0fc9  10 f1        djnz 0x0fbc
 * loc_0fcb:
 *   0fcb  79           ld   a,c        <-- NOT TRANSLATED
 *   0fcc  ef           rst  0x28       <-- NOT TRANSLATED (dispatcher)
 *
 * Called once, from `call 0x0f56` at 0x0D5F. CONTAINS NO `ret`: the only exit
 * from this routine is the `rst 0x28` at 0x0FCC. What that does to the return
 * address pushed at 0x0D5F is deliberately NOT modelled here.
 *
 * BOTH exits from the translated body land on 0x0FCB: the `jr nz` at 0x0FB3
 * and the fallthrough off the `djnz` at 0x0FC9.
 */
export function loc_0f56(m) {
  const { regs, mem } = m;

  // ---- clear 0x6200-0x6226, 0x27 bytes ----
  regs.b = 0x27;
  m.step(0x0f58, 7);
  regs.hl = 0x6200;
  m.step(0x0f5b, 10);
  regs.xor(regs.a); // A = 0 -- the fill value for BOTH clear loops
  m.step(0x0f5c, 4);
  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x0f5d, 7);
    regs.l = regs.inc8(regs.l); // `inc l`, NOT `inc hl` -- no carry into H
    m.step(0x0f5e, 4);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0f5c : 0x0f60, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  // ---- clear 17 blocks of 0x80 from 0x6280 -> 0x6280-0x6AFF ----
  regs.c = 0x11;
  m.step(0x0f62, 7);
  regs.d = 0x80;
  m.step(0x0f64, 7);
  regs.hl = 0x6280;
  m.step(0x0f67, 10);
  do {
    regs.b = regs.d;
    m.step(0x0f68, 4);
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x0f69, 7);
      regs.hl = (regs.hl + 1) & 0xffff; // `inc hl` here, full 16-bit
      m.step(0x0f6a, 6);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0f68 : 0x0f6c, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.c = regs.dec8(regs.c);
    m.step(0x0f6d, 4);
    m.step(regs.fNZ ? 0x0f67 : 0x0f6f, regs.fNZ ? 12 : 7);
  } while (regs.fNZ);

  // ---- copy 0x40 bytes of ROM DATA 0x3D9C-0x3DDB to 0x6280-0x62BF ----
  regs.hl = 0x3d9c;
  m.step(0x0f72, 10);
  regs.de = 0x6280;
  m.step(0x0f75, 10);
  regs.bc = 0x0040;
  m.step(0x0f78, 10);
  m.ldirAt(0x0f78, 0x0f7a); // NOT the 0x01CF-hardcoded ldir()

  // ---- A = min( (0x6229)*10 + 0x28 , 0x50 ) -- ALL MOD 256 ----
  regs.a = mem.read8(0x6229);
  m.step(0x0f7d, 13);
  regs.b = regs.a;
  m.step(0x0f7e, 4);
  // `and a` clears carry so the following `rla` shifts a 0 into bit 0 and the
  // bit shifted OUT of bit 7 is discarded. Three pairs = A = (A*8) & 0xFF.
  for (const [andNext, rlaNext] of [[0x0f7f, 0x0f80], [0x0f81, 0x0f82],
                                    [0x0f83, 0x0f84]]) {
    regs.and(regs.a);
    m.step(andNext, 4);
    regs.rla();
    m.step(rlaNext, 4);
  }
  regs.add(regs.b); // A = A*8 + A0
  m.step(0x0f85, 4);
  regs.add(regs.b); // A = A*8 + 2*A0  == A0*10 mod 256
  m.step(0x0f86, 4);
  regs.add(0x28);
  m.step(0x0f88, 7);
  regs.cp(0x51);
  m.step(0x0f8a, 7);
  if (regs.fC) {
    m.step(0x0f8e, 12);
  } else {
    m.step(0x0f8c, 7);
    regs.a = 0x50; // clamp -- bounds the RESULT, does NOT detect wrap
    m.step(0x0f8e, 7);
  }

  // ---- store that value at 0x62B0,B1,B2 ----
  regs.hl = 0x62b0;
  m.step(0x0f91, 10);
  regs.b = 0x03;
  m.step(0x0f93, 7);
  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x0f94, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0f95, 4);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0f93 : 0x0f97, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  // HL is NOT reloaded below -- it carries out of this loop as 0x62B3

  // ---- A = max( 0xDC - 2*A , 0x28 ) ----
  regs.add(regs.a); // add a,a -- A = 2A
  m.step(0x0f98, 4);
  regs.b = regs.a;
  m.step(0x0f99, 4);
  regs.a = 0xdc;
  m.step(0x0f9b, 7);
  regs.sub(regs.b);
  m.step(0x0f9c, 4);
  regs.cp(0x28);
  m.step(0x0f9e, 7);
  if (regs.fNC) {
    m.step(0x0fa2, 12);
  } else {
    m.step(0x0fa0, 7);
    regs.a = 0x28; // Is this reachable at all?
    m.step(0x0fa2, 7);
  }

  // ---- store at 0x62B3, 0x62B4 (HL carried from the 0x0F93 loop) ----
  mem.write8(regs.hl, regs.a);
  m.step(0x0fa3, 7);
  regs.l = regs.inc8(regs.l);
  m.step(0x0fa4, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x0fa5, 7);

  // ---- 0x6209 = 4, 0x620A = 8 ----
  regs.hl = 0x6209;
  m.step(0x0fa8, 10);
  mem.write8(regs.hl, 0x04);
  m.step(0x0faa, 10);
  regs.l = regs.inc8(regs.l);
  m.step(0x0fab, 4);
  mem.write8(regs.hl, 0x08);
  m.step(0x0fad, 10);

  // ---- C = (0x6227). C IS THE DISPATCHER INDEX -- live to 0x0FCB ----
  regs.a = mem.read8(0x6227);
  m.step(0x0fb0, 13);
  regs.c = regs.a;
  m.step(0x0fb1, 4);
  const bit2 = regs.bit(2, regs.a); // does not modify A; preserves carry
  m.step(0x0fb3, 8);
  if (bit2) {
    m.step(0x0fcb, 12); // Branches straight INTO the withheld unit
  } else {
    m.step(0x0fb5, 7);

    // ---- seed 3 x 4 bytes at 0x6A00-0x6A0B ----
    regs.hl = 0x6a00;
    m.step(0x0fb8, 10);
    regs.a = 0x4f;
    m.step(0x0fba, 7);
    regs.b = 0x03;
    m.step(0x0fbc, 7);
    do {
      mem.write8(regs.hl, regs.a);
      m.step(0x0fbd, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x0fbe, 4);
      mem.write8(regs.hl, 0x3a);
      m.step(0x0fc0, 10);
      regs.l = regs.inc8(regs.l);
      m.step(0x0fc1, 4);
      mem.write8(regs.hl, 0x0f);
      m.step(0x0fc3, 10);
      regs.l = regs.inc8(regs.l);
      m.step(0x0fc4, 4);
      mem.write8(regs.hl, 0x18);
      m.step(0x0fc6, 10);
      regs.l = regs.inc8(regs.l);
      m.step(0x0fc7, 4);
      regs.add(0x10);
      m.step(0x0fc9, 7);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x0fbc : 0x0fcb, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
  }

  // ---- 0x0FCB: ld a,c / rst 0x28 -- the inline-jump-table dispatcher ----
  regs.a = regs.c;
  m.step(0x0fcc, 4);
  m.push16(0x0fcd); // rst 0x28 pushes the address AFTER it -- the TABLE BASE
  m.step(0x0028, 11);


  //
  // The draft flagged that loc_0f56 contains no `ret` and asked what becomes
  // of the 0x0D62 pushed by `call 0x0f56` at 0x0D5F. The 2441 draft went
  // further: if the rst consumed its CALLER'S return address as inline table
  // data, then `cd 41 24` at 0x0D62 would be a DECODE ARTIFACT rather than an
  // executed instruction.
  //
  // It does not. `rst 0x28` pushes ITS OWN continuation (0x0FCD) and the
  // dispatcher's `pop hl` takes exactly that back off as the table base. The
  // caller's 0x0D62 is never touched -- it sits one slot deeper throughout,
  // and it is what the dispatched target's `ret` eventually pops.
  //
  // So `call 0x2441` at 0x0D62 IS executed, and the coverage data showing
  // 0x2441 running is consistent with it being reached that way after all.
  // A routine having no `ret` of its own is real, and is NOT the same claim
  // as its caller not being returned to -- which is the conflation the
  // tracer's `returns_normally` makes.
  //
  // Table at 0x0FCD, five entries, indexed by C = (0x6227):
  //   0 -> 0x0000 (unused)   1 -> 0x0FD7   2 -> 0x101F
  //   3 -> 0x1087            4 -> 0x1131
  // THE rst 0x28 BODY, MODELLED RATHER THAN SUMMARISED -- ROM 0x0028-0x0037:
  //
  //   0028  87        add  a,a     ; A = 2*index
  //   0029  e1        pop  hl      ; HL = 0x0FCD, THE TABLE BASE -- this is
  //                                ;   the pop that consumes the push above
  //   002a  5f        ld   e,a
  //   002b  16 00     ld   d,0x00  ; DE = 2*index
  //   002d  c3 32 00  jp   0x0032
  //   0032  19        add  hl,de   ; HL = table base + 2*index
  //   0033  5e        ld   e,(hl)
  //   0034  23        inc  hl
  //   0035  56        ld   d,(hl)
  //   0036  eb        ex   de,hl   ; HL = the target
  //   0037  e9        jp   (hl)
  //
  // 4+10+4+7+10+11+7+6+7+4+4 = 74 T, which is exactly the constant this site
  // already carried -- the faithful body reproduces the summary's timing.
  //
  // THE `pop hl` WAS PREVIOUSLY NOT MODELLED AT ALL. The push above ran, this
  // pop did not, and every dispatch therefore left one extra slot on the
  // stack. It stayed invisible for exactly as long as no dispatched target
  // reached a `ret` -- loc_0fd7 threw NotImplemented first. Completing
  // loc_0fd7 made the first such `ret` execute and it popped the stale 0x0FCD
  // instead of the caller's 0x0D62.
  //
  // The comment above this one states the mechanism CORRECTLY and the code
  // implemented half of it: the push was modelled because it was written as a
  // push, the pop was dissolved into a 74-cycle summary. The assertion
  // was true of the ROM and false of the model, and the prose being right is
  // what stopped anyone checking. Registers were dropped the same way; they
  // happen to be dead into loc_0fd7, which overwrites HL, DE and BC before
  // reading anything and contains no conditional, but the other four table
  // entries are next and nothing guarantees that for them.
  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a
  regs.hl = m.pop16(); // pop hl -- the table base, balancing the push
  m.step(0x002a, 10);
  regs.e = regs.a;
  m.step(0x002b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // ld d,0x00
  m.step(0x0032, 10); // jp 0x0032
  regs.addHl(regs.de); // sets H, N, C -- dead into loc_0fd7, not in general
  m.step(0x0033, 11); // add hl,de
  regs.e = mem.read8(regs.hl);
  m.step(0x0034, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0035, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0036, 7); // ld d,(hl)
  const target = regs.de; // ex de,hl: HL becomes the target, DE the pointer
  regs.de = regs.hl;
  regs.hl = target;
  m.step(0x0037, 4); // ex de,hl
  m.step(target, 4); // jp (hl)

  if (target === 0x0fd7) return m.call(0x0fd7);
  if (target === 0x101f) return m.call(0x101f); // board 2 (0x6227==2, 0x0FCD table idx 2)
  if (target === 0x1087) return m.call(0x1087); // board 3 (0x0FCD table idx 3)
  if (target === 0x1131) return m.call(0x1131); // board 4 (0x0FCD table idx 4)
  throw new NotImplemented(
    `loc_0f56 dispatches via rst 0x28 to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(table at 0x0FCD, index C=${regs.c}), which is not translated.`,
  );
}
