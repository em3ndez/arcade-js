// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_021c  (ROM 0x021c-0x022c, The Pit) — a restart/boot entry: seeds the
 * mode cell 0x8001 with 3, RESETS the stack to the top of work RAM, enables the
 * NMI, runs the display-mode setup, then TAIL-jumps into the fixed-screen painter
 * at 0x3ba8 (which loops forever and never returns).
 *
 *   021c  3e 03        ld   a,0x03
 *   021e  32 01 80     ld   (0x8001),a
 *   0221  31 ff 83     ld   sp,0x83ff
 *   0224  cd 14 4b     call 0x4b14
 *   0227  cd 44 4b     call 0x4b44
 *   022a  c3 a8 3b     jp   0x3ba8
 *
 * Reached from loc_01f9's `jp nz,0x021c` (taken when 0x8000 != 0). It writes 3 to
 * the mode selector at 0x8001, then `ld sp,0x83ff` REINITIALISES the stack pointer
 * to the top of work RAM — DISCARDING whatever return address the caller left, so
 * this path never returns to its caller; it is a hard restart into the display
 * loop. `call 0x4b14` enables the NMI (LS259 bit 0), `call 0x4b44` runs the A=0
 * display-mode setup, and both push/pop on the freshly reset stack.
 *
 * The final `jp 0x3ba8` is a TAIL-jump: it pushes nothing, and 0x3ba8 paints a
 * fixed screen and drops into its own forever-loop (loc_3bdf), so control never
 * comes back here. Modelled the oracle's tail-jump way — `m.step(target,10)` then
 * `return m.call(target)` — so the target's control flow (here: no return)
 * propagates unchanged. NOT the `m.call(target); m.ret()` shape: a plain `jp`
 * pushes no word and performs no ret of its own (that shape would corrupt the
 * diffed stack RAM and charge a spurious second ret).
 *
 * `ld a,n`, `ld (nn),a` and `ld sp,nn` touch no flags, so F is whatever the caller
 * held; the hardware/work-RAM write at 0x8001 passes busOffset 10 (`ld (nn),a`).
 */
export function loc_021c(m) {
  const { regs, mem } = m;

  regs.a = 0x03;
  m.step(0x021e, 7); // 021c  ld a,0x03

  mem.write8(0x8001, regs.a, 10); // 021e  ld (0x8001),a -- mode cell = 3
  m.step(0x0221, 13);

  regs.sp = 0x83ff; // 0221  ld sp,0x83ff -- reset stack, discarding caller's return
  m.step(0x0224, 10);

  m.push16(0x0227); // 0224  call 0x4b14 -- enable the NMI
  m.step(0x4b14, 17);
  m.call(0x4b14);

  m.push16(0x022a); // 0227  call 0x4b44 -- A=0 display-mode setup
  m.step(0x4b44, 17);
  m.call(0x4b44);

  // 022a  jp 0x3ba8 -- tail-jump into the fixed-screen painter (never returns)
  m.step(0x3ba8, 10);
  return m.call(0x3ba8);
}
