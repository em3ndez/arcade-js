// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_0c6d  (ROM 0x0C51-0x0D10) — the attract MARQUEE assembler, one phase per call from loc_0d11.
// The phase counter 0x83D7 counts down 4..0 (reloaded to 5 when it hits 0); `jp (hl)` at 0x0C81
// indexes the jr-trampoline table at 0x0C82 by 2*phase: HL = 0x0C82 + 2*phase, phases 0..3 `jr` to
// {0x0CC0,0x0C51,0x0CEB,0x0CC6}, phase 4 lands on 0x0C8A directly. Phase 0 (0x0CC0) parks 0x83D8=0xC0;
// the other arms blit their logo strips (loc_0ba0/loc_0b9b + rst 0x28) and join the shared tail
// 0x0CBA, which parks 0x83D8=0x80. Arms + table all fold into this one file.
export function loc_0c6d(m) {
  const { regs, mem } = m;

  regs.hl = 0x83d8;
  m.step(0x0c70, 10);

  regs.l = regs.dec8(regs.l);
  m.step(0x0c71, 4); // HL = 0x83d7 -- the phase counter

  regs.a = mem.read8(regs.hl);
  m.step(0x0c72, 7);

  regs.or(regs.a);
  m.step(0x0c73, 4);

  if (regs.fNZ) {
    m.step(0x0c77, 12); // jr nz,0x0c77
  } else {
    m.step(0x0c75, 7);
    mem.write8(regs.hl, 0x05);
    m.step(0x0c77, 10); // (0x83d7) = 5 -- reload the phase counter
  }

  // loc_0c77:
  regs.decMem8(mem, regs.hl);
  m.step(0x0c78, 11); // (0x83d7)-- -- phase in 0..4

  regs.a = mem.read8(regs.hl);
  m.step(0x0c79, 7);

  regs.add(regs.a);
  m.step(0x0c7a, 4); // A = 2*phase

  regs.hl = 0x0c82;
  m.step(0x0c7d, 10);

  regs.e = regs.a;
  m.step(0x0c7e, 4);

  regs.d = 0x00;
  m.step(0x0c80, 7); // DE = 2*phase

  regs.addHl(regs.de);
  m.step(0x0c81, 11); // HL = 0x0c82 + 2*phase -- the jr-trampoline slot

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x0c82: // phase 0
      m.step(0x0cc0, 12); // jr 0x0cc0
      return arm_0cc0();
    case 0x0c84: // phase 1
      m.step(0x0c51, 12);
      return arm_0c51();
    case 0x0c86: // phase 2
      m.step(0x0ceb, 12);
      return arm_0ceb();
    case 0x0c88: // phase 3
      m.step(0x0cc6, 12);
      return arm_0cc6();
    case 0x0c8a: // phase 4 -- lands on the arm directly (no jr)
      return arm_0c8a();
    default:
      throw new NotImplemented(
        `loc_0c6d jp(hl) at 0x0c81: phase HL=0x${regs.hl.toString(16)} outside {0x0c82..0x0c8a}`,
      );
  }

  // ======== phase arms (all fold in; each blits then joins the shared tail) ========

  function arm_0cc0() {
    // phase 0 -- park the marquee state at 0xC0
    regs.hl = 0x83d8;
    m.step(0x0cc3, 10);
    mem.write8(regs.hl, 0xc0);
    m.step(0x0cc5, 10); // (0x83d8) = 0xc0
    m.ret();
  }

  function arm_0c51() {
    regs.hl = 0xab76;
    m.step(0x0c54, 10);
    regs.de = 0x2f9e;
    m.step(0x0c57, 10);
    regs.b = 0x0a;
    m.step(0x0c59, 7);
    m.push16(0x0c5a);
    m.step(0x0028, 11); // rst 0x28 -- blit 0x0a tiles
    m.call(0x0028);

    regs.hl = 0xab77;
    m.step(0x0c5d, 10);
    regs.a = 0x10;
    m.step(0x0c5f, 7);
    m.push16(0x0c62);
    m.step(0x0ba0, 17); // call 0x0ba0 -- two BCD digits
    m.call(0x0ba0);

    regs.de = 0x2fba;
    m.step(0x0c65, 10);
    regs.b = 0x04;
    m.step(0x0c67, 7);
    m.push16(0x0c68);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.b = 0x13;
    m.step(0x0c6a, 7);
    m.push16(0x0c6b);
    m.step(0x0028, 11);
    m.call(0x0028);

    m.step(0x0cba, 12); // jr 0x0cba
    return tail_0cba();
  }

  function arm_0ceb() {
    regs.hl = 0xab73;
    m.step(0x0cee, 10);
    regs.de = 0x1000;
    m.step(0x0cf1, 10);
    m.push16(0x0cf4);
    m.step(0x0b9b, 17); // call 0x0b9b -- four BCD digits
    m.call(0x0b9b);

    regs.de = 0x2fba;
    m.step(0x0cf7, 10);
    regs.b = 0x04;
    m.step(0x0cf9, 7);
    m.push16(0x0cfa);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.de = 0x2f39;
    m.step(0x0cfd, 10);
    regs.b = 0x0a;
    m.step(0x0cff, 7);
    m.push16(0x0d00);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.de = 0x2fae;
    m.step(0x0d03, 10);
    regs.b = 0x06;
    m.step(0x0d05, 7);
    m.push16(0x0d06);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.hl = 0xab74;
    m.step(0x0d09, 10);
    regs.de = 0x2f2a;
    m.step(0x0d0c, 10);
    regs.b = 0x0f;
    m.step(0x0d0e, 7);
    m.push16(0x0d0f);
    m.step(0x0028, 11);
    m.call(0x0028);

    m.step(0x0cba, 12); // jr 0x0cba
    return tail_0cba();
  }

  function arm_0cc6() {
    regs.hl = 0xab70;
    m.step(0x0cc9, 10);
    regs.a = 0x50;
    m.step(0x0ccb, 7);
    m.push16(0x0cce);
    m.step(0x0ba0, 17); // call 0x0ba0
    m.call(0x0ba0);

    regs.de = 0x2fba;
    m.step(0x0cd1, 10);
    regs.b = 0x04;
    m.step(0x0cd3, 7);
    m.push16(0x0cd4);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.de = 0x2f43;
    m.step(0x0cd7, 10);
    regs.b = 0x0a;
    m.step(0x0cd9, 7);
    m.push16(0x0cda);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.de = 0x2fae;
    m.step(0x0cdd, 10);
    regs.b = 0x05;
    m.step(0x0cdf, 7);
    m.push16(0x0ce0);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.hl = 0xab71;
    m.step(0x0ce3, 10);
    regs.de = 0x2f17;
    m.step(0x0ce6, 10);
    regs.b = 0x13;
    m.step(0x0ce8, 7);
    m.push16(0x0ce9);
    m.step(0x0028, 11);
    m.call(0x0028);

    m.step(0x0cba, 12); // jr 0x0cba
    return tail_0cba();
  }

  function arm_0c8a() {
    regs.a = 0x06;
    m.step(0x0c8c, 7);
    mem.write8(0x801d, regs.a);
    m.step(0x0c8f, 13);
    mem.write8(0x8023, regs.a);
    m.step(0x0c92, 13);
    mem.write8(0x8029, regs.a);
    m.step(0x0c95, 13);
    mem.write8(0x802f, regs.a);
    m.step(0x0c98, 13); // (0x801d/23/29/2f) = 6 -- sprite Y band

    regs.a = 0x03;
    m.step(0x0c9a, 7);
    mem.write8(0x801b, regs.a);
    m.step(0x0c9d, 13);
    mem.write8(0x8021, regs.a);
    m.step(0x0ca0, 13);
    mem.write8(0x8027, regs.a);
    m.step(0x0ca3, 13);
    mem.write8(0x802d, regs.a);
    m.step(0x0ca6, 13); // (0x801b/21/27/2d) = 3 -- sprite code band

    regs.a = 0x10;
    m.step(0x0ca8, 7);
    regs.hl = 0xab6d;
    m.step(0x0cab, 10);
    m.push16(0x0cae);
    m.step(0x0ba0, 17); // call 0x0ba0
    m.call(0x0ba0);

    regs.de = 0x2fba;
    m.step(0x0cb1, 10);
    regs.b = 0x04;
    m.step(0x0cb3, 7);
    m.push16(0x0cb4);
    m.step(0x0028, 11);
    m.call(0x0028);

    regs.de = 0x2ed1;
    m.step(0x0cb7, 10);
    regs.b = 0x0e;
    m.step(0x0cb9, 7);
    m.push16(0x0cba);
    m.step(0x0028, 11);
    m.call(0x0028);

    return tail_0cba(); // falls through into 0x0cba
  }

  function tail_0cba() {
    regs.hl = 0x83d8;
    m.step(0x0cbd, 10);
    mem.write8(regs.hl, 0x80);
    m.step(0x0cbf, 10); // (0x83d8) = 0x80 -- marquee phase done
    m.ret();
  }
}
