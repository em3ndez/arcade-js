// SPDX-License-Identifier: GPL-3.0-only

// loc_020f  (ROM 0x020F-0x0241) -- the attract-mode state driver. Reached by
// `jp` from 0x01d2 and 0x0738. It reads the state byte selected by (0x88a1),
// and either runs the per-frame worker (0x0254) or dispatches through the
// handler table at 0x0242 via `jp (hl)`, pushing 0x020f so the handler's ret
// loops back here. An infinite loop -- it only leaves via the NMI or a handler.
export function loc_020f(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.h = 0x88;
    m.step(0x0211, 7);
    regs.a = mem.read8(0x88a1);
    m.step(0x0214, 13);
    regs.l = regs.a;
    m.step(0x0215, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x0216, 7);
    regs.add(regs.a); // add a,a -- bit 7 into carry, value doubled
    m.step(0x0217, 4);

    if (!regs.fNC) {
      // bit 7 set: run the per-frame worker, then loop.
      m.step(0x0219, 7);
      m.push16(0x021c);
      m.step(0x0254, 17);
      m.call(0x0254);
      m.step(0x020f, 12);
      continue;
    }
    m.step(0x021e, 12); // jr nc taken -> dispatcher

    regs.and(0x1f); // (state*2) & 0x1f = even byte offset into the 0x0242 table
    m.step(0x0220, 7);
    regs.c = regs.a;
    m.step(0x0221, 4);
    regs.b = 0x00;
    m.step(0x0223, 7);
    mem.write8(regs.hl, 0xff); // free this slot
    m.step(0x0225, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0226, 6);
    regs.e = mem.read8(regs.hl);
    m.step(0x0227, 7);
    mem.write8(regs.hl, 0xff);
    m.step(0x0229, 10);
    regs.l = regs.inc8(regs.l);
    m.step(0x022a, 4);
    regs.a = regs.l;
    m.step(0x022b, 4);
    regs.cp(0xc0);
    m.step(0x022d, 7);
    if (regs.fNC) {
      m.step(0x0231, 12);
    } else {
      m.step(0x022f, 7);
      regs.a = 0xc0; // wrap the slot pointer back to 0xC0
      m.step(0x0231, 7);
    }

    mem.write8(0x88a1, regs.a);
    m.step(0x0234, 13);
    regs.a = regs.e;
    m.step(0x0235, 4);
    regs.hl = 0x0242;
    m.step(0x0238, 10);
    regs.addHl(regs.bc);
    m.step(0x0239, 11);
    regs.e = mem.read8(regs.hl);
    m.step(0x023a, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x023b, 6);
    regs.d = mem.read8(regs.hl);
    m.step(0x023c, 7);
    regs.hl = 0x020f;
    m.step(0x023f, 10);
    m.push16(regs.hl); // handler returns here
    m.step(0x0240, 11);
    regs.exDeHl();
    m.step(0x0241, 4);
    m.step(regs.hl, 4); // jp (hl)
    m.call(regs.hl);
    continue;
  }
}
