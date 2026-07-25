// SPDX-License-Identifier: GPL-3.0-only
import { dispatchTask } from "./dispatchTask.js";

/**
 * mainLoop  (ROM 0x02BD–0x02E2) — the task-scheduler main loop; synchronises to the vblank NMI.
 *
 *   02bd  26 60        ld   h,0x60           ; loc_02bd
 *   02bf  3a b1 60     ld   a,(0x60b1)
 *   02c2  6f           ld   l,a
 *   02c3  7e           ld   a,(hl)
 *   02c4  87           add  a,a
 *   02c5  30 1c        jr   nc,0x02e3
 *   02c7  cd 15 03     call 0x0315
 *   02ca  cd 50 03     call 0x0350
 *   02cd  21 19 60     ld   hl,0x6019
 *   02d0  34           inc  (hl)
 *   02d1  21 83 63     ld   hl,0x6383
 *   02d4  3a 1a 60     ld   a,(0x601a)
 *   02d7  be           cp   (hl)
 *   02d8  28 e3        jr   z,0x02bd
 *   02da  77           ld   (hl),a
 *   02db  cd 7f 03     call 0x037f
 *   02de  cd a2 03     call 0x03a2
 *   02e1  18 da        jr   0x02bd
 *
 * H is fixed at 0x60 and L comes from the task-list pointer at 0x60B1, so
 * the loop walks a task table in page 0x60. `add a,a` tests bit 7 of the task
 * byte: set means "run the per-frame work", clear means "dispatch this task"
 * via the path at 0x02E3.
 *
 * Boot leaves 0x60B1 = 0xC0 and fills 0x60C0-0x60FF with 0xFF, so the first
 * iteration reads 0xFF, `add a,a` sets carry, and the `jr nc` is not taken.
 */
export function mainLoop(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.h = 0x60;
    m.step(0x02bf, 7);
    regs.a = mem.read8(0x60b1);
    m.step(0x02c2, 13);
    regs.l = regs.a;
    m.step(0x02c3, 4);
    regs.a = mem.read8(regs.hl);
    m.step(0x02c4, 7);
    regs.add(regs.a); // add a,a -- bit 7 into carry
    m.step(0x02c5, 4);

    if (regs.fNC) {
      m.step(0x02e3, 12); // jr nc taken
      dispatchTask(m);
      continue; // 0x02E3 pushes 0x02BD, so its ret lands back here
    }
    m.step(0x02c7, 7); // jr nc not taken

    m.push16(0x02ca);
    m.step(0x0315, 17); // call 0x0315
    m.call(0x0315);

    m.push16(0x02cd);
    m.step(0x0350, 17); // call 0x0350
    m.call(0x0350);

    regs.hl = 0x6019;
    m.step(0x02d0, 10);
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl)
    m.step(0x02d1, 11);

    regs.hl = 0x6383;
    m.step(0x02d4, 10);
    regs.a = mem.read8(0x601a);
    m.step(0x02d7, 13);
    regs.cp(mem.read8(regs.hl)); // cp (hl)
    m.step(0x02d8, 7);

    if (regs.fZ) {
      // Frame counter unchanged -- spin here until the NMI decrements it.
      // THIS is where the machine actually sits when vblank arrives.
      m.step(0x02bd, 12);
      continue;
    }
    m.step(0x02da, 7);

    mem.write8(regs.hl, regs.a); // remember the frame we just handled
    m.step(0x02db, 7);

    m.push16(0x02de);
    m.step(0x037f, 17);
    m.call(0x037f);

    m.push16(0x02e1);
    m.step(0x03a2, 17);
    m.call(0x03a2);

    m.step(0x02bd, 12); // jr 0x02bd
  }
}
