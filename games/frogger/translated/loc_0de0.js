// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_0de0  (ROM 0x0DE0-0x0E73) — the attract board-DEMO cell assembler, called from loc_0e7a each
// dwell tick. Dwell counter 0x83BC counts down; `ret nz` until it hits 0, then reloads 0x20 and
// dispatches on the phase counter 0x83D7 (1..7) via `jp (hl)` at 0x0E00: HL = 0x0DFF + 2*phase,
// phases 1..6 `jr` to {0x0E49,0x0E3F,0x0E35,0x0E2B,0x0E21,0x0E17}, phase 7 lands on 0x0E0D directly.
// Each arm loads one river-object cell (src/obj/tile) then joins the shared tail 0x0E51, which lays
// the four tiles + clears a 0x0400 band, decrements 0x83D7 (reload 7 at 0), and falls into loc_0e74.
export function loc_0de0(m) {
  const { regs, mem } = m;

  regs.a = 0x03;
  m.step(0x0de2, 7);
  mem.write8(0x800d, regs.a);
  m.step(0x0de5, 13);
  mem.write8(0x800f, regs.a);
  m.step(0x0de8, 13); // (0x800d/0f) = 3 -- demo scroll registers

  regs.a = mem.read8(0x83bc);
  m.step(0x0deb, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x0dec, 4);
  mem.write8(0x83bc, regs.a);
  m.step(0x0def, 13); // (0x83bc)-- -- the dwell counter

  if (regs.fNZ) {
    m.ret(11); // ret nz -- still dwelling
    return;
  }
  m.step(0x0df0, 5);

  regs.a = 0x20;
  m.step(0x0df2, 7);
  mem.write8(0x83bc, regs.a);
  m.step(0x0df5, 13); // (0x83bc) = 0x20 -- reload the dwell

  regs.a = mem.read8(0x83d7);
  m.step(0x0df8, 13); // A = phase in 1..7
  regs.add(regs.a);
  m.step(0x0df9, 4); // A = 2*phase
  regs.d = 0x00;
  m.step(0x0dfb, 7);
  regs.e = regs.a;
  m.step(0x0dfc, 4); // DE = 2*phase
  regs.hl = 0x0dff;
  m.step(0x0dff, 10);
  regs.addHl(regs.de);
  m.step(0x0e00, 11); // HL = 0x0dff + 2*phase -- the jr-trampoline slot

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x0e01: // phase 1
      m.step(0x0e49, 12); // jr 0x0e49
      return arm(0x0e49, 0xa8c6, 0x8058, 0xd8, false);
    case 0x0e03: // phase 2
      m.step(0x0e3f, 12);
      return arm(0x0e3f, 0xa926, 0x8054, 0xf8, true);
    case 0x0e05: // phase 3
      m.step(0x0e35, 12);
      return arm(0x0e35, 0xa986, 0x8050, 0xf4, true);
    case 0x0e07: // phase 4
      m.step(0x0e2b, 12);
      return arm(0x0e2b, 0xa9e6, 0x804c, 0xf4, true);
    case 0x0e09: // phase 5
      m.step(0x0e21, 12);
      return arm(0x0e21, 0xaa46, 0x8048, 0xdc, true);
    case 0x0e0b: // phase 6
      m.step(0x0e17, 12);
      return arm(0x0e17, 0xaaa6, 0x8044, 0xd8, true);
    case 0x0e0d: // phase 7 -- lands on the arm directly (no jr)
      return arm(0x0e0d, 0xab06, 0x8040, 0xd4, true);
    default:
      throw new NotImplemented(
        `loc_0de0 jp(hl) at 0x0e00: phase HL=0x${regs.hl.toString(16)} outside {0x0e01..0x0e0d}`,
      );
  }

  // Each 10-byte arm loads HL=src, DE=obj, A=tile, then jr 0x0e51 (loc_0e49 falls through). `at` is
  // the arm's own address; the three `m.step` targets and the jr flag differ only by that base.
  function arm(at, src, obj, tile, jumps) {
    regs.hl = src;
    m.step((at + 3) & 0xffff, 10);
    regs.de = obj;
    m.step((at + 6) & 0xffff, 10);
    regs.a = tile;
    m.step(jumps ? (at + 8) & 0xffff : 0x0e51, 7);
    if (jumps) m.step(0x0e51, 12); // jr 0x0e51
    return tail_0e51();
  }

  // loc_0e51: stamp the 4 corner tiles of the cell (HL video RAM), then clear a 0x0400 tile band.
  function tail_0e51() {
    regs.bc = 0x001f;
    m.step(0x0e54, 10);
    mem.write8(regs.hl, regs.a);
    m.step(0x0e55, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x0e56, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0e57, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x0e58, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x0e59, 4);
    regs.addHl(regs.bc);
    m.step(0x0e5a, 11); // HL += 0x1f -- drop to the cell's bottom row
    mem.write8(regs.hl, regs.a);
    m.step(0x0e5b, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x0e5c, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0e5d, 4);
    mem.write8(regs.hl, regs.a);
    m.step(0x0e5e, 7);
    regs.exDeHl();
    m.step(0x0e5f, 4); // HL = obj base
    regs.bc = 0x0400;
    m.step(0x0e62, 10); // B=4 clear count, C=0 fill byte

    // loc_0e62: clear B bytes forward from HL
    for (;;) {
      mem.write8(regs.hl, regs.c);
      m.step(0x0e63, 7);
      regs.l = regs.inc8(regs.l);
      m.step(0x0e64, 4);
      if (m.regs.djnz() !== 0) {
        m.step(0x0e62, 13);
        continue;
      }
      m.step(0x0e66, 8);
      break;
    }

    regs.hl = 0x83d7;
    m.step(0x0e69, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x0e6a, 11); // (0x83d7)-- -- one fewer cell to place

    if (regs.fNZ) {
      m.ret(11); // ret nz -- cells remain
      return;
    }
    m.step(0x0e6b, 5);

    mem.write8(regs.hl, 0x07);
    m.step(0x0e6d, 10); // (0x83d7) = 7 -- reload the phase counter
    regs.xor(regs.a);
    m.step(0x0e6e, 4);
    mem.write8(0x83bf, regs.a);
    m.step(0x0e71, 13);
    mem.write8(0x83bb, regs.a);
    m.step(0x0e74, 13); // (0x83bf/bb) = 0 -- reset the attract sequencer

    return m.call(0x0e74); // fall through into loc_0e74
  }
}
