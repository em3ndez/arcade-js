// SPDX-License-Identifier: GPL-3.0-only

// loc_272f  (ROM 0x272F-0x279E) — fly/insect X-movement driver. Runs the tongue/attack timer at (0x833e):
// counting down it toggles the sprite code at (0x8041); at zero it walks the fly's X-offset table (base
// 0x279f, indexed via the folded add-hl helper block_279a, ROM 0x279A-0x279E) into position (0x8040).
export function loc_272f(m) {
  const { regs, mem } = m;

  regs.hl = 0x833e;
  m.step(0x2732, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x2733, 7);
  regs.and(regs.a);
  m.step(0x2734, 4);
  if (regs.fZ) { m.step(0x2761, 12); return block_2761(); }
  m.step(0x2736, 7);
  regs.decMem8(mem, regs.hl);
  m.step(0x2737, 11); // (0x833e) tongue timer--
  regs.a = 0x3c;
  m.step(0x2739, 7);
  regs.a = regs.srl(regs.a);
  m.step(0x273b, 8); // A = 0x1e, the timer midpoint
  regs.cp(mem.read8(regs.hl));
  m.step(0x273c, 7);
  if (regs.fNZ) { m.step(0x274d, 12); return block_274d(); }
  m.step(0x273e, 7);
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x273f, 6); // HL = 0x833d, the direction byte
  regs.a = mem.read8(regs.hl);
  m.step(0x2740, 7);
  regs.and(regs.a);
  m.step(0x2741, 4); // sign of the direction byte selects the sprite code
  regs.a = 0x21;
  m.step(0x2743, 7);
  mem.write8(0x8041, regs.a);
  m.step(0x2746, 13);
  if (regs.fP) { m.ret(11); return; }
  m.step(0x2747, 5);
  regs.a = 0xa1;
  m.step(0x2749, 7); // mirrored sprite code (bit 7 = flip)
  mem.write8(0x8041, regs.a);
  m.step(0x274c, 13);
  m.ret();

  function block_274d() {
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x274e, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x274f, 7);
    regs.and(0x7f);
    m.step(0x2751, 7); // drop the direction bit -> table index
    regs.hl = 0x279f;
    m.step(0x2754, 10);
    regs.a = regs.inc8(regs.a);
    m.step(0x2755, 4);
    m.push16(0x2758);
    m.step(0x279a, 17);
    block_279a();
    regs.a = mem.read8(regs.hl);
    m.step(0x2759, 7); // A = the table's X-offset for this step
    regs.hl = 0x811c;
    m.step(0x275c, 10);
    regs.add(mem.read8(regs.hl));
    m.step(0x275d, 7); // + the lane base at (0x811c)
    mem.write8(0x8040, regs.a);
    m.step(0x2760, 13);
    m.ret();
  }

  function block_2761() {
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x2762, 6); // HL = 0x833d
    regs.a = mem.read8(regs.hl);
    m.step(0x2763, 7);
    regs.and(regs.a);
    m.step(0x2764, 4);
    if (regs.fP) { m.step(0x2769, 10); return block_2769(); }
    m.step(0x2767, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x2768, 11);
    regs.decMem8(mem, regs.hl);
    m.step(0x2769, 11); // step the direction byte back by two, then re-enter
    return block_2769();
  }

  function block_2769() {
    regs.incMem8(mem, regs.hl);
    m.step(0x276a, 11);
    regs.a = mem.read8(regs.hl);
    m.step(0x276b, 7);
    regs.and(0x7f);
    m.step(0x276d, 7);
    regs.hl = 0x279f;
    m.step(0x2770, 10);
    m.push16(0x2773);
    m.step(0x279a, 17);
    block_279a();
    regs.a = mem.read8(regs.hl);
    m.step(0x2774, 7);
    regs.cp(0x01);
    m.step(0x2776, 7);
    if (regs.fC) { m.step(0x2782, 12); return block_2782(); }
    m.step(0x2778, 7); // A == 0 -> wrap (block_2782)
    if (regs.fZ) { m.step(0x2794, 12); return block_2794(); }
    m.step(0x277a, 7); // A == 1 -> hold (block_2794)
    regs.hl = 0x811c;
    m.step(0x277d, 10);
    regs.add(mem.read8(regs.hl));
    m.step(0x277e, 7);
    mem.write8(0x8040, regs.a);
    m.step(0x2781, 13);
    m.ret();
  }

  function block_2782() {
    regs.hl = 0x833d;
    m.step(0x2785, 10);
    regs.a = mem.read8(regs.hl);
    m.step(0x2786, 7);
    regs.xor(0x80);
    m.step(0x2788, 7); // flip the fly's travel direction
    mem.write8(regs.hl, regs.a);
    m.step(0x2789, 7);
    regs.a = 0x3c;
    m.step(0x278b, 7);
    mem.write8(0x833e, regs.a);
    m.step(0x278e, 13); // reload the tongue timer
    regs.a = 0x1e;
    m.step(0x2790, 7);
    mem.write8(0x8041, regs.a);
    m.step(0x2793, 13);
    m.ret();
  }

  function block_2794() {
    regs.a = 0x3c;
    m.step(0x2796, 7);
    mem.write8(0x833e, regs.a);
    m.step(0x2799, 13);
    m.ret();
  }

  // folded add-hl helper (ROM 0x279A-0x279E): HL += A across the page boundary
  function block_279a() {
    regs.add(regs.l);
    m.step(0x279b, 4);
    regs.l = regs.a;
    m.step(0x279c, 4);
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x279d, 5);
    regs.h = regs.inc8(regs.h);
    m.step(0x279e, 4);
    m.ret();
  }
}
