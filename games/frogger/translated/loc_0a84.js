// SPDX-License-Identifier: GPL-3.0-only

// loc_0a84  (ROM 0x0A84-0x0AB9) — insert a 2-byte value (D,E) into the sorted 5-entry table ending
// at 0x83F2, walking B=5 slots downward. On finding the insertion slot it LDDRs the tail down to make
// room and stores D,E; the return in A encodes the slot index (2*slot+1), 0 if no insertion.
export function loc_0a84(m) {
  const { regs, mem } = m;

  regs.b = 0x05;
  m.step(0x0a86, 7);
  regs.hl = 0x83f2;
  m.step(0x0a89, 10);
  return block_0a89();

  function block_0a89() {
    regs.a = regs.d;
    m.step(0x0a8a, 4);
    regs.cp(mem.read8(regs.hl));
    m.step(0x0a8b, 7); // cp (hl) -- D vs this slot's key
    if (regs.fC) {
      m.step(0x0ab4, 12);
      return block_0ab4();
    }
    m.step(0x0a8d, 7);
    if (regs.fZ) {
      m.step(0x0aa8, 12);
      return block_0aa8();
    }
    m.step(0x0a8f, 7);
    return block_0a8f();
  }

  function block_0a8f() {
    regs.a = regs.b;
    m.step(0x0a90, 4);
    regs.a = regs.dec8(regs.a);
    m.step(0x0a91, 4);
    if (regs.fZ) {
      m.step(0x0aa2, 12);
      return block_0aa2();
    }
    m.step(0x0a93, 7);
    regs.add(regs.a);
    m.step(0x0a94, 4); // A = 2*(B-1)
    regs.c = regs.a;
    m.step(0x0a95, 4);
    regs.b = 0x00;
    m.step(0x0a97, 7); // BC = 2*(B-1) bytes to shift
    m.push16(regs.de);
    m.step(0x0a98, 11);
    regs.de = 0x83fa;
    m.step(0x0a9b, 10);
    regs.hl = 0x83f8;
    m.step(0x0a9e, 10);
    m.lddrAt(0x0a9e, 0x0aa0); // open a gap by copying the tail down
    regs.exDeHl();
    m.step(0x0aa1, 4);
    regs.de = m.pop16();
    m.step(0x0aa2, 10);
    return block_0aa2();
  }

  function block_0aa2() {
    mem.write8(regs.hl, regs.d);
    m.step(0x0aa3, 7); // store the new key high byte
    regs.l = regs.dec8(regs.l);
    m.step(0x0aa4, 4);
    mem.write8(regs.hl, regs.e);
    m.step(0x0aa5, 7); // store the new key low byte
    return block_0aa5();
  }

  function block_0aa5() {
    regs.add(regs.a);
    m.step(0x0aa6, 4);
    regs.a = regs.inc8(regs.a);
    m.step(0x0aa7, 4); // A = 2*slot + 1
    m.ret();
  }

  function block_0aa8() {
    regs.l = regs.dec8(regs.l);
    m.step(0x0aa9, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x0aaa, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0aab, 4);
    regs.cp(regs.e);
    m.step(0x0aac, 4); // cp e -- tie-break on the low byte
    if (regs.fC) {
      m.step(0x0a8f, 12);
      return block_0a8f();
    }
    m.step(0x0aae, 7);
    if (regs.fNZ) {
      m.step(0x0ab4, 12);
      return block_0ab4();
    }
    m.step(0x0ab0, 7);
    regs.a = regs.b;
    m.step(0x0ab1, 4);
    regs.a = regs.dec8(regs.a);
    m.step(0x0ab2, 4);
    if (regs.fZ) {
      m.step(0x0aa5, 12);
      return block_0aa5();
    }
    m.step(0x0ab4, 7);
    return block_0ab4();
  }

  function block_0ab4() {
    regs.l = regs.inc8(regs.l);
    m.step(0x0ab5, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0ab6, 4); // advance to the next slot
    if (m.regs.djnz() !== 0) {
      m.step(0x0a89, 13);
      return block_0a89();
    }
    m.step(0x0ab8, 8);
    regs.xor(regs.a);
    m.step(0x0ab9, 4); // A = 0 -- no slot found
    m.ret();
  }
}
