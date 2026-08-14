// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_0e7a  (ROM 0x0E7A-0x0F3D) — the attract-demo sequencer, called each vblank from the NMI
// (0x012B, `call z,0x0e7a`, only while the credit count 0x83E1 is zero). Credits present -> tail
// to loc_0e74. Otherwise a state machine on the phase byte (0x83BF): 0 seeds the demo (call
// 0x0766/0x064b, lay out 7 cells at 0x8040), 1 runs the scroll animator, 2 rewinds, >2 tail-jumps
// to 0x0de0. The animator's `jp (hl)` at 0x0EC2 indexes a jr-trampoline table at 0x0EC3 by
// 2*(0x83D7): HL = 0x0EC1 + 2*phase, phases 1..7 -> {0x0EC3,0x0EC5,0x0EC7,0x0EC9,0x0ECB,0x0ECD,
// 0x0ECF}; slots 1..6 `jr` to the six cell bodies (0x8058..0x8044), phase 7 lands on the 0x8040
// body directly. All arms fall into the shared tail 0x0EFE (call 0x0f3e; scroll the cell -4px).
export function loc_0e7a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83e1);
  m.step(0x0e7d, 13); // A = (0x83e1) credit count (BCD)

  regs.or(regs.a);
  m.step(0x0e7e, 4);

  if (regs.fNZ) {
    m.step(0x0e74, 12); // jr nz,0x0e74 -- credits present, force attract idle
    return m.call(0x0e74);
  }
  m.step(0x0e80, 7);

  regs.hl = 0x83bf;
  m.step(0x0e83, 10);

  regs.a = mem.read8(regs.hl);
  m.step(0x0e84, 7); // A = (0x83bf) attract phase

  regs.or(regs.a);
  m.step(0x0e85, 4);

  if (regs.fNZ) {
    m.step(0x0eb4, 12);
    return block_0eb4();
  }

  // ---- phase 0: seed the attract demo ----
  m.step(0x0e87, 7);

  m.push16(0x0e8a);
  m.step(0x0766, 17); // call 0x0766 -- fill the tilemap band with tile 0x10
  m.call(0x0766);

  m.push16(0x0e8d);
  m.step(0x064b, 17); // call 0x064b -- clear the demo work RAM + OBJRAM
  m.call(0x064b);

  regs.hl = 0x8040;
  m.step(0x0e90, 10);

  regs.bc = 0x0703;
  m.step(0x0e93, 10); // B=0x07 cell count, C=0x03

  regs.de = 0x8100;
  m.step(0x0e96, 10); // D=0x81, E=0x00

  for (;;) {
    // loc_0e96: lay out 7 cells, 4 bytes each at 0x8040+4n
    mem.write8(regs.hl, regs.e);
    m.step(0x0e97, 7); // (0x804n+0) = 0x00

    regs.l = regs.inc8(regs.l);
    m.step(0x0e98, 4);

    regs.l = regs.inc8(regs.l);
    m.step(0x0e99, 4);

    mem.write8(regs.hl, regs.c);
    m.step(0x0e9a, 7); // (0x804n+2) = 0x03

    regs.l = regs.inc8(regs.l);
    m.step(0x0e9b, 4);

    mem.write8(regs.hl, regs.d);
    m.step(0x0e9c, 7); // (0x804n+3) = 0x81

    regs.l = regs.inc8(regs.l);
    m.step(0x0e9d, 4);

    if (m.regs.djnz() !== 0) {
      m.step(0x0e96, 13);
      continue;
    }
    m.step(0x0e9f, 8);
    break;
  }

  regs.hl = 0x0504;
  m.step(0x0ea2, 10);

  mem.write16(0x83bd, regs.hl);
  m.step(0x0ea5, 16); // (0x83bd)=0x04 frame timer, (0x83be)=0x05 frame index

  return block_0ea5();

  // ======== interior blocks ========

  function block_0ea5() {
    // reached by phase-0 fall-through and by the phase-2 `jp z,0x0ea5`
    regs.hl = 0x83d7;
    m.step(0x0ea8, 10);

    mem.write8(regs.hl, 0x07);
    m.step(0x0eaa, 10); // (0x83d7) = 7 -- phase counter, so boot enters the phase-7 cell

    regs.hl = 0x83bc;
    m.step(0x0ead, 10);

    mem.write8(regs.hl, 0x20);
    m.step(0x0eaf, 10); // (0x83bc) = 0x20

    return block_0eaf();
  }

  function block_0eaf() {
    // reached by fall-through and by the animator's `jr 0x0eaf` at 0x0F14
    regs.hl = 0x83bf;
    m.step(0x0eb2, 10);

    regs.incMem8(mem, regs.hl);
    m.step(0x0eb3, 11); // (0x83bf)++ -- advance to the next attract phase

    m.ret();
  }

  function block_0eb4() {
    regs.a = regs.dec8(regs.a);
    m.step(0x0eb5, 4); // A = (0x83bf) - 1

    if (regs.fNZ) {
      m.step(0x0f16, 12);
      return block_0f16();
    }

    // ---- phase 1: the scroll animator ----
    m.step(0x0eb7, 7);

    regs.a = mem.read8(0x83d7);
    m.step(0x0eba, 13); // A = (0x83d7) phase in 1..7

    regs.add(regs.a);
    m.step(0x0ebb, 4); // add a,a -- A = 2*phase

    regs.d = 0x00;
    m.step(0x0ebd, 7);

    regs.e = regs.a;
    m.step(0x0ebe, 4); // DE = 2*phase

    regs.hl = 0x0ec1;
    m.step(0x0ec1, 10);

    regs.addHl(regs.de);
    m.step(0x0ec2, 11); // HL = 0x0ec1 + 2*phase -- the jr-trampoline slot

    m.step(regs.hl, 4); // jp (hl)
    switch (regs.hl) {
      case 0x0ec3: // phase 1
        m.step(0x0ef9, 12); // jr 0x0ef9
        return arm_0ef9();
      case 0x0ec5: // phase 2
        m.step(0x0ef2, 12);
        return arm_0ef2();
      case 0x0ec7: // phase 3
        m.step(0x0eeb, 12);
        return arm_0eeb();
      case 0x0ec9: // phase 4
        m.step(0x0ee4, 12);
        return arm_0ee4();
      case 0x0ecb: // phase 5
        m.step(0x0edd, 12);
        return arm_0edd();
      case 0x0ecd: // phase 6
        m.step(0x0ed6, 12);
        return arm_0ed6();
      case 0x0ecf: // phase 7 -- lands on the cell body directly (no jr)
        return arm_0ecf();
      default:
        throw new NotImplemented(
          `loc_0e7a jp(hl) at 0x0ec2: phase HL=0x${regs.hl.toString(16)} outside the arm table {0x0ec3..0x0ecf}`,
        );
    }
  }

  // Each arm loads the cell base (0x8040+4n) and its scroll limit B, then joins the shared tail.
  function arm_0ecf() {
    regs.hl = 0x8040;
    m.step(0x0ed2, 10);
    regs.b = 0x31;
    m.step(0x0ed4, 7); // scroll limit
    m.step(0x0efe, 12); // jr 0x0efe
    return block_0efe();
  }
  function arm_0ed6() {
    regs.hl = 0x8044;
    m.step(0x0ed9, 10);
    regs.b = 0x49;
    m.step(0x0edb, 7);
    m.step(0x0efe, 12);
    return block_0efe();
  }
  function arm_0edd() {
    regs.hl = 0x8048;
    m.step(0x0ee0, 10);
    regs.b = 0x61;
    m.step(0x0ee2, 7);
    m.step(0x0efe, 12);
    return block_0efe();
  }
  function arm_0ee4() {
    regs.hl = 0x804c;
    m.step(0x0ee7, 10);
    regs.b = 0x79;
    m.step(0x0ee9, 7);
    m.step(0x0efe, 12);
    return block_0efe();
  }
  function arm_0eeb() {
    regs.hl = 0x8050;
    m.step(0x0eee, 10);
    regs.b = 0x91;
    m.step(0x0ef0, 7);
    m.step(0x0efe, 12);
    return block_0efe();
  }
  function arm_0ef2() {
    regs.hl = 0x8054;
    m.step(0x0ef5, 10);
    regs.b = 0xa9;
    m.step(0x0ef7, 7);
    m.step(0x0efe, 12);
    return block_0efe();
  }
  function arm_0ef9() {
    regs.hl = 0x8058;
    m.step(0x0efc, 10);
    regs.b = 0xc1;
    m.step(0x0efe, 7); // falls through to 0x0efe (no jr)
    return block_0efe();
  }

  function block_0efe() {
    m.push16(0x0f01);
    m.step(0x0f3e, 17); // call 0x0f3e -- advance this cell's animation frame
    if (!m.call(0x0f3e)) return; // 0x0f56 skip-out: it already ret'd to loc_0e7a's caller

    regs.c = regs.a;
    m.step(0x0f02, 4); // C = the new animation tile

    regs.decMem8(mem, regs.hl);
    m.step(0x0f03, 11);
    regs.decMem8(mem, regs.hl);
    m.step(0x0f04, 11);
    regs.decMem8(mem, regs.hl);
    m.step(0x0f05, 11);
    regs.decMem8(mem, regs.hl);
    m.step(0x0f06, 11); // (0x804n+0) -= 4 -- scroll the cell left 4px

    regs.a = mem.read8(regs.hl);
    m.step(0x0f07, 7);

    regs.l = regs.inc8(regs.l);
    m.step(0x0f08, 4);

    mem.write8(regs.hl, regs.c);
    m.step(0x0f09, 7); // store the animation tile

    regs.cp(regs.b);
    m.step(0x0f0a, 4); // cp b -- past this arm's scroll limit?

    if (regs.fNC) {
      m.ret(11); // ret nc -- limit not yet reached
      return;
    }
    m.step(0x0f0b, 5);

    mem.write8(regs.hl, 0x1e);
    m.step(0x0f0d, 10); // clamp the tile to 0x1e at the limit

    regs.hl = 0x83d7;
    m.step(0x0f10, 10);

    regs.decMem8(mem, regs.hl);
    m.step(0x0f11, 11); // dec (0x83d7) -- one fewer cell to run

    if (regs.fNZ) {
      m.ret(11); // ret nz -- cells remain
      return;
    }
    m.step(0x0f12, 5);

    mem.write8(regs.hl, 0x14);
    m.step(0x0f14, 10); // (0x83d7) = 0x14 -- reload for the next phase

    m.step(0x0eaf, 12); // jr 0x0eaf
    return block_0eaf();
  }

  function block_0f16() {
    regs.a = regs.dec8(regs.a);
    m.step(0x0f17, 4); // A = (0x83bf) - 2

    if (regs.fNZ) {
      m.step(0x0de0, 10); // jp nz,0x0de0 -- phase advanced past 2
      return m.call(0x0de0);
    }

    // ---- phase 2: rewind the 7 cells ----
    m.step(0x0f1a, 10);

    m.push16(0x0f1d);
    m.step(0x0f3e, 17); // call 0x0f3e
    if (!m.call(0x0f3e)) return; // 0x0f56 skip-out

    regs.sub(0x03);
    m.step(0x0f1f, 7);

    regs.c = regs.a;
    m.step(0x0f20, 4);

    regs.a = mem.read8(0x83d7);
    m.step(0x0f23, 13);

    regs.or(regs.a);
    m.step(0x0f24, 4);

    if (regs.fZ) {
      m.step(0x0ea5, 10); // jp z,0x0ea5 -- phase counter drained, restart the animator
      return block_0ea5();
    }
    m.step(0x0f27, 10);

    regs.b = 0x07;
    m.step(0x0f29, 7); // B=0x07 cell count

    regs.de = 0x0006;
    m.step(0x0f2c, 10);

    regs.hl = 0x8043;
    m.step(0x0f2f, 10);

    for (;;) {
      // loc_0f2f: step each cell back
      regs.decMem8(mem, regs.hl);
      m.step(0x0f30, 11);
      regs.decMem8(mem, regs.hl);
      m.step(0x0f31, 11);
      regs.decMem8(mem, regs.hl);
      m.step(0x0f32, 11);
      regs.decMem8(mem, regs.hl);
      m.step(0x0f33, 11); // (0x804n+3) -= 4

      regs.l = regs.dec8(regs.l);
      m.step(0x0f34, 4);

      regs.l = regs.dec8(regs.l);
      m.step(0x0f35, 4);

      mem.write8(regs.hl, regs.c);
      m.step(0x0f36, 7); // (0x804n+1) = C

      regs.addHl(regs.de);
      m.step(0x0f37, 11); // DE=0x06 -> next cell base

      if (m.regs.djnz() !== 0) {
        m.step(0x0f2f, 13);
        continue;
      }
      m.step(0x0f39, 8);
      break;
    }

    regs.a = regs.dec8(regs.a);
    m.step(0x0f3a, 4);

    mem.write8(0x83d7, regs.a);
    m.step(0x0f3d, 13); // (0x83d7) -= 1

    m.ret();
  }
}
