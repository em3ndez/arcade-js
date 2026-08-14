// SPDX-License-Identifier: GPL-3.0-only

// loc_0341  (ROM 0x0341-0x040A) — the main/attract loop, entered once from cold boot (loc_02a3
// fall-through) and re-entered each pass via its own `jr 0x0341`. Every pass: dispatch on the mode
// byte (0x83D6) — `call nc,0x0d11` when mode>=2 (the attract/mode dispatcher), `call 0x0b1f`, then
// `call nz,0x0b67` and `call 0x230f`. After a spin-delay on (0x83C7) it either jumps to the in-play
// entry loc_040b (when 0x83FE set) or, on a START press with enough credits, deducts a credit and
// runs the one-time new-game setup (0x03A7-0x040A) before falling into loc_040b.
export function loc_0341(m) {
  const { regs, mem } = m;

  for (;;) {
    // loc_0341:
    regs.a = mem.read8(0x83d6);
    m.step(0x0344, 13); // A = (0x83d6) mode byte

    regs.cp(0x02);
    m.step(0x0346, 7);

    if (regs.fNC) {
      m.push16(0x0349);
      m.step(0x0d11, 17); // call nc,0x0d11 -- mode>=2 attract/mode dispatcher
      m.call(0x0d11);
    } else {
      m.step(0x0349, 10);
    }

    m.push16(0x034c);
    m.step(0x0b1f, 17); // call 0x0b1f
    m.call(0x0b1f);

    regs.a = mem.read8(0x83d6);
    m.step(0x034f, 13);

    regs.a = regs.dec8(regs.a);
    m.step(0x0350, 4); // Z iff mode == 1

    if (regs.fNZ) {
      m.push16(0x0353);
      m.step(0x0b67, 17); // call nz,0x0b67
      m.call(0x0b67);
    } else {
      m.step(0x0353, 10);
    }

    m.push16(0x0356);
    m.step(0x230f, 17); // call 0x230f
    m.call(0x230f);

    regs.a = 0x02;
    m.step(0x0358, 7);
    regs.hl = 0x8254;
    m.step(0x035b, 10);
    mem.write8(regs.hl, regs.a);
    m.step(0x035c, 7); // (0x8254)=0x02
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x035d, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x035e, 7); // (0x8255)=0x02
    regs.a = 0x09;
    m.step(0x0360, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0361, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x0362, 7); // (0x8256)=0x09
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0363, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x0364, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0365, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x0366, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0367, 6);
    mem.write8(regs.hl, regs.a);
    m.step(0x0368, 7); // (0x8254..0x8257) = 02 02 09 09 09 09

    // loc_0368:
    regs.hl = mem.read16(0x83c7);
    m.step(0x036b, 16); // HL = (0x83c7) spin-delay count

    for (;;) {
      // loc_036b: count HL down to 0
      regs.a = regs.h;
      m.step(0x036c, 4);
      regs.or(regs.l);
      m.step(0x036d, 4); // Z iff HL == 0 before the dec
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x036e, 6);
      if (regs.fNZ) {
        m.step(0x036b, 12);
        continue;
      }
      m.step(0x0370, 7);
      break;
    }

    regs.a = mem.read8(0x83fe);
    m.step(0x0373, 13); // A = (0x83fe) play flag
    regs.or(regs.a);
    m.step(0x0374, 4);
    if (regs.fNZ) {
      m.step(0x040b, 10); // jp nz,0x040b -- a game is in progress
      return m.call(0x040b);
    }
    m.step(0x0377, 10);

    regs.a = mem.read8(0x83b3);
    m.step(0x037a, 13);
    regs.or(regs.a);
    m.step(0x037b, 4);
    if (regs.fNZ) {
      m.step(0x0341, 12); // jr nz,0x0341 -- start already latched, loop
      continue;
    }
    m.step(0x037d, 7);

    regs.a = mem.read8(0xe002);
    m.step(0x0380, 13); // A = IN1 (START bits)
    regs.rlca();
    m.step(0x0381, 4); // C = old bit 7 (START1)
    if (regs.fNC) {
      m.step(0x038a, 12); // jr nc,0x038a
      // loc_038a:
      regs.c = 0x01;
      m.step(0x038c, 7); // 1-player: cost 1 credit
    } else {
      m.step(0x0383, 7);
      regs.rlca();
      m.step(0x0384, 4); // C = old bit 6 (START2)
      if (regs.fC) {
        m.step(0x0341, 12); // jr c,0x0341 -- neither start held, loop
        continue;
      }
      m.step(0x0386, 7);
      regs.c = 0x02;
      m.step(0x0388, 7); // 2-player: cost 2 credits
      m.step(0x038c, 12); // jr 0x038c
    }

    // loc_038c:
    regs.a = mem.read8(0x83e1);
    m.step(0x038f, 13); // A = (0x83e1) credit count (BCD)
    regs.cp(regs.c);
    m.step(0x0390, 4);
    if (regs.fC) {
      m.step(0x0341, 12); // jr c,0x0341 -- not enough credits, loop
      continue;
    }
    m.step(0x0392, 7);

    regs.sub(regs.c);
    m.step(0x0393, 4);
    regs.daa();
    m.step(0x0394, 4); // BCD credit -= C
    mem.write8(0x83e1, regs.a);
    m.step(0x0397, 13);
    regs.a = regs.c;
    m.step(0x0398, 4); // A = player count (1 or 2)
    mem.write8(0x8370, regs.a);
    m.step(0x039b, 13);

    regs.hl = 0x8500;
    m.step(0x039e, 10);
    regs.de = 0x8501;
    m.step(0x03a1, 10);
    regs.bc = 0x01ff;
    m.step(0x03a4, 10);
    mem.write8(regs.hl, regs.l);
    m.step(0x03a5, 7); // ld (hl),l -- L=0x00 seeds the fill
    m.ldirAt(0x03a5, 0x03a7); // clear 0x8500-0x86ff

    mem.write8(0x83fe, regs.a);
    m.step(0x03aa, 13); // (0x83fe) = player count -- game now in progress
    regs.a = 0x01;
    m.step(0x03ac, 7);
    mem.write8(0x83fd, regs.a);
    m.step(0x03af, 13);
    mem.write8(0x83b3, regs.a);
    m.step(0x03b2, 13);
    regs.h = regs.a;
    m.step(0x03b3, 4);
    regs.l = regs.a;
    m.step(0x03b4, 4);
    mem.write8(0x83b7, regs.a);
    m.step(0x03b7, 13);
    mem.write16(0x83b8, regs.hl);
    m.step(0x03ba, 16); // (0x83b8) = 0x0101

    m.push16(0x03bd);
    m.step(0x0b0a, 17); // call 0x0b0a
    m.call(0x0b0a);

    regs.a = 0x03;
    m.step(0x03bf, 7);
    mem.write8(0x803d, regs.a);
    m.step(0x03c2, 13);

    m.push16(0x03c5);
    m.step(0x07d9, 17); // call 0x07d9
    m.call(0x07d9);

    regs.xor(regs.a);
    m.step(0x03c6, 4);
    mem.write8(0x8071, regs.a);
    m.step(0x03c9, 13);

    m.push16(0x03ca);
    m.step(0x0018, 11); // rst 0x18 -- enqueue sound command 0x00
    m.call(0x0018);
    regs.a = 0x09;
    m.step(0x03cc, 7);
    m.push16(0x03cd);
    m.step(0x0018, 11); // rst 0x18 -- 0x09
    m.call(0x0018);
    regs.a = 0x0a;
    m.step(0x03cf, 7);
    m.push16(0x03d0);
    m.step(0x0018, 11); // rst 0x18 -- 0x0a
    m.call(0x0018);
    regs.a = 0x0b;
    m.step(0x03d2, 7);
    m.push16(0x03d3);
    m.step(0x0018, 11); // rst 0x18 -- 0x0b
    m.call(0x0018);

    regs.hl = 0x0020;
    m.step(0x03d6, 10);
    mem.write16(0x829d, regs.hl);
    m.step(0x03d9, 16);
    regs.hl = 0x01a0;
    m.step(0x03dc, 10);
    mem.write16(0x8382, regs.hl);
    m.step(0x03df, 16);
    regs.hl = 0x0000;
    m.step(0x03e2, 10);
    mem.write16(0x83d2, regs.hl);
    m.step(0x03e5, 16);

    m.push16(0x03e8);
    m.step(0x07e6, 17); // call 0x07e6
    m.call(0x07e6);

    m.push16(0x03e9);
    m.step(0x0038, 11); // rst 0x38 -- clear the tilemap
    m.call(0x0038);

    m.push16(0x03ec);
    m.step(0x223d, 17); // call 0x223d
    m.call(0x223d);

    regs.xor(regs.a);
    m.step(0x03ed, 4);
    regs.h = regs.a;
    m.step(0x03ee, 4);
    regs.l = regs.a;
    m.step(0x03ef, 4);
    mem.write8(0x842f, regs.a);
    m.step(0x03f2, 13);
    mem.write8(0x842d, regs.a);
    m.step(0x03f5, 13);
    mem.write16(0x8293, regs.hl);
    m.step(0x03f8, 16);

    regs.hl = 0x8440;
    m.step(0x03fb, 10);
    regs.de = 0x8441;
    m.step(0x03fe, 10);
    regs.bc = 0x004f;
    m.step(0x0401, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x0402, 7); // ld (hl),b -- B=0x00 seeds the fill
    m.ldirAt(0x0402, 0x0404); // clear 0x8440-0x848f

    mem.write8(0x8004, regs.a);
    m.step(0x0407, 13); // A=0
    regs.a = regs.inc8(regs.a);
    m.step(0x0408, 4);
    mem.write8(0x825a, regs.a);
    m.step(0x040b, 13); // (0x825a)=1

    return m.call(0x040b); // fall through to loc_040b
  }
}
