// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2853  (ROM 0x2853–0x286E) — SETUP + DISPATCH trampoline. (28 bytes).
 * Called from entry_1ac3 @ 0x1C20 (resolves spine-1's forward-ref).
 *
 *   2853  fd 21 00 62  ld   iy,0x6200
 *   2857  3a 05 62     ld   a,(0x6205)     ; player Y
 *   285a  c6 0c        add  a,0x0c
 *   285c  4f           ld   c,a            ; C = Y + 0x0C
 *   285d  3a 10 60     ld   a,(0x6010)     ; input
 *   2860  e6 03        and  0x03
 *   2862  21 08 05     ld   hl,0x0508      ; default parameter pair
 *   2865  ca 6b 28     jp   z,0x286b       ; (input&3)==0 -> keep 0x0508
 *   2868  21 08 13     ld   hl,0x1308      ; else pair 0x1308
 *   286b  cd 88 3e     call 0x3e88         ; the rst-28 dispatcher
 *  286e c9 ret ; the `defb`-hidden ret
 *
 * (named loc_2853 to match entry_1ac3's forward-ref; the draft used sub_2853).
 * Not yet wired into the live dispatcher: called only from entry_1ac3 @0x1C20.
 *
 * ** RETURNS NORMALLY ** via entry_3e88's BALANCED dispatch (and my
 * wave-1 entry_3e88 + 0x28xx targets all pop the pushed HL): the target's
 * `pop hl` matches 3e88's `push hl`, the rst consumes its own table pointer, and
 * the target's `ret` lands on 0x286E. NOT a caller-skip -- which is exactly why
 * entry_1ac3's 0x1C23 "UNREACHED" block is reached. IY/C/HL are dispatch
 * parameters for entry_3e88 (HL = 0x0508 for input dir 0, else 0x1308 -- the
 * collision-bound pair). Params/targets not interpreted.
 */
export function loc_2853(m) {
  const { regs, mem } = m;
  regs.iy = 0x6200;
  m.step(0x2857, 14); // ld iy,0x6200
  regs.a = mem.read8(0x6205); // player Y
  m.step(0x285a, 13); // ld a,(0x6205)
  regs.add(0x0c);
  m.step(0x285c, 7); // add a,0x0c
  regs.c = regs.a; // C = Y + 0x0C
  m.step(0x285d, 4); // ld c,a
  regs.a = mem.read8(0x6010); // input
  m.step(0x2860, 13); // ld a,(0x6010)
  regs.and(0x03); // direction bits
  m.step(0x2862, 7); // and 0x03
  regs.hl = 0x0508; // default pair
  m.step(0x2865, 10); // ld hl,0x0508
  if (regs.fZ) {
    m.step(0x286b, 10); // jp z -- (input&3)==0, keep 0x0508
  } else {
    m.step(0x2868, 10);
    regs.hl = 0x1308; // else pair
    m.step(0x286b, 10); // ld hl,0x1308
  }

  m.push16(0x286e); // `call` pushes; 3e88's dispatch returns here
  m.step(0x3e88, 17); // call 0x3e88
  m.call(0x3e88); // BALANCED dispatch -- returns normally (NOT a caller-skip)
  m.ret(10); // 0x286E -- the ret the listing hid as `defb 0xc9`
}
