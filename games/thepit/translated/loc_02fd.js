// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_02fd  (ROM 0x02fd-0x0319, The Pit) — branches on the game-state byte
 * (0x8001): when the state is >= 3 it TAIL-jumps to loc_03ac (the state-reset
 * path); otherwise it bumps the counter at (0x8028), runs a short display/setup
 * sequence, then FALLS THROUGH into loc_031a (the per-frame loop head).
 *
 *   02fd  3a 01 80     ld   a,(0x8001)    ; load the game-state byte
 *   0300  fe 03        cp   0x03          ; carry set when state < 3
 *   0302  d2 ac 03     jp   nc,0x03ac     ; state >= 3 -> TAIL to loc_03ac (reset)
 *   0305  3a 28 80     ld   a,(0x8028)    ; else: reload the counter
 *   0308  3c           inc  a
 *   0309  32 28 80     ld   (0x8028),a    ; bump the counter
 *   030c  cd 32 46     call 0x4632
 *   030f  3e a0        ld   a,0xa0        ; A=0xa0 argument
 *   0311  cd 46 4b     call 0x4b46
 *   0314  cd ec 3b     call 0x3bec
 *   0317  cd 32 46     call 0x4632        ; returns to 0x031a
 * loc_031a:            (fall-through into the next routine)
 *
 * `cp 0x03` sets carry iff (0x8001) < 3, so `jp nc` is taken iff (0x8001) >= 3.
 * A jp pushes nothing, so the taken branch is a TAIL-jump: loc_03ac's own ret
 * pops OUR caller's return and lands one frame up — modelled `return m.call(0x03ac)`,
 * NOT `m.call; m.ret()` (that shape would push a spurious word onto the diffed
 * stack and charge a second ret; see loc_02ca.js / loc_02e1.js).
 *
 * The routine has NO ret of its own. When the branch is not taken it runs the
 * body and simply FALLS THROUGH into loc_031a — there is no branch instruction at
 * the boundary: the `call 0x4632` at 0x0317 already advanced PC to 0x031a, so the
 * fall-through is modelled as `return m.call(0x031a)` with NO extra m.step (nothing
 * is executed between them). loc_031a's ret then returns to loc_02fd's caller,
 * exactly as loc_02e1 / loc_02ca reach loc_031a. Work-RAM stores to (0x8028) take
 * no bus offset.
 */
export function loc_02fd(m) {
  const { regs, mem } = m;

  // 02fd  ld a,(0x8001) -- load the game-state byte
  regs.a = mem.read8(0x8001);
  m.step(0x0300, 13);

  // 0300  cp 0x03 -- carry set when state < 3
  regs.cp(0x03);
  m.step(0x0302, 7);

  // 0302  jp nc,0x03ac -- state >= 3: TAIL-jump to the reset path (loc_03ac)
  if (regs.fNC) {
    m.step(0x03ac, 10);
    return m.call(0x03ac); // loc_03ac's ret returns to OUR caller
  }
  m.step(0x0305, 10); // not taken: fall through to 0x0305 (jp cc is 10T either way)

  // 0305  ld a,(0x8028) -- reload the counter
  regs.a = mem.read8(0x8028);
  m.step(0x0308, 13);

  // 0308  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x0309, 4);

  // 0309  ld (0x8028),a -- bump the counter (work RAM, no bus offset)
  mem.write8(0x8028, regs.a);
  m.step(0x030c, 13);

  // 030c  call 0x4632
  m.push16(0x030f);
  m.step(0x4632, 17);
  m.call(0x4632);

  // 030f  ld a,0xa0 -- argument for the next call
  regs.a = 0xa0;
  m.step(0x0311, 7);

  // 0311  call 0x4b46 (A=0xa0)
  m.push16(0x0314);
  m.step(0x4b46, 17);
  m.call(0x4b46);

  // 0314  call 0x3bec
  m.push16(0x0317);
  m.step(0x3bec, 17);
  m.call(0x3bec);

  // 0317  call 0x4632 -- returns to 0x031a
  m.push16(0x031a);
  m.step(0x4632, 17);
  m.call(0x4632);

  // fall-through into loc_031a: no branch instruction here, PC is already 0x031a
  // (the call above returned to it), so no m.step. loc_031a's ret returns to OUR
  // caller, exactly like a tail-jump would.
  return m.call(0x031a);
}
