// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4683  (ROM 0x4683-0x46a1) — award 20 (BCD) points to the active player's
 * score, then repaint the digits. Calls 0x4c8f (a sound/effect kick), loads the
 * BCD increment 0x0020 into BC, and falls into the shared scorer at sub_4689:
 * it reads the player-slot byte at 0x8001 and only awards when (0x8001) is 1 or 2
 * (`dec a` / `cp 0x02` / `jr nc` skips to the bare `ret` at 0x4672 otherwise),
 * then does the two-byte BCD add of BC into the score at 0x8031 (low) / 0x8034
 * (high) with `daa` after each byte so the inter-byte carry propagates. It closes
 * with `jr 0x46af`, a TAIL-jump into sub_46af (splits the BCD bytes into on-screen
 * digit cells); the jr pushes nothing, so sub_46af's own `ret` returns to OUR
 * caller — hence `m.step(0x46af,12); return m.call(0x46af)`, NOT m.call()+m.ret()
 * (which would pop a second word off the stack).
 *
 * sub_4689 is a shared entry (sub_4673 preloads BC=0x0001, sub_467b BC=0x0010);
 * this routine reaches it by fall-through with BC=0x0020.
 *
 * The carry into `adc a,b` is the carry the low-byte `daa` left — the two loads
 * between them (`ld (0x8031),a`, `ld a,(0x8034)`) touch no flags. The `jr nc`
 * reads the carry from `cp 0x02` (`dec a` set flags first but `cp` overwrites).
 *
 *   4683  cd 8f 4c     call 0x4c8f
 *   4686  01 20 00     ld   bc,0x0020
 *   4689  3a 01 80     ld   a,(0x8001)
 *   468c  3d           dec  a
 *   468d  fe 02        cp   0x02
 *   468f  30 e1        jr   nc,0x4672      ; 0x4672 is a bare `ret` -> skip award
 *   4691  3a 31 80     ld   a,(0x8031)
 *   4694  81           add  a,c
 *   4695  27           daa
 *   4696  32 31 80     ld   (0x8031),a
 *   4699  3a 34 80     ld   a,(0x8034)
 *   469c  88           adc  a,b
 *   469d  27           daa
 *   469e  32 34 80     ld   (0x8034),a
 *   46a1  18 0c        jr   0x46af         ; TAIL into sub_46af (repaint digits)
 */
export function sub_4683(m) {
  const { regs, mem } = m;

  // 4683  call 0x4c8f -- sound/effect kick; its register effects are overwritten below.
  m.push16(0x4686);
  m.step(0x4c8f, 17);
  m.call(0x4c8f);

  regs.bc = 0x0020;
  m.step(0x4689, 10); // 4686  ld bc,0x0020 -- BCD points-to-add = 0x20

  // sub_4689 (shared scorer entry; reached here by fall-through with BC=0x0020)
  regs.a = mem.read8(0x8001);
  m.step(0x468c, 13); // 4689  ld a,(0x8001) -- active-player slot
  regs.a = regs.dec8(regs.a);
  m.step(0x468d, 4); // 468c  dec a
  regs.cp(0x02);
  m.step(0x468f, 7); // 468d  cp 0x02 -- carry set iff (0x8001)-1 < 2, i.e. slot in {1,2}

  if (regs.fNC) {
    // 468f  jr nc,0x4672 taken -- slot not in {1,2}; 0x4672 is a bare `ret`.
    m.step(0x4672, 12);
    m.ret(); // the ret at 0x4672 (10 T) -> back to OUR caller, no score change
    return;
  }
  m.step(0x4691, 7); // 468f  jr nc,0x4672 NOT taken

  regs.a = mem.read8(0x8031);
  m.step(0x4694, 13); // 4691  ld a,(0x8031) -- score low BCD byte
  regs.add(regs.c);
  m.step(0x4695, 4); // 4694  add a,c
  regs.daa();
  m.step(0x4696, 4); // 4695  daa -- BCD-correct the low byte (may set carry)
  mem.write8(0x8031, regs.a);
  m.step(0x4699, 13); // 4696  ld (0x8031),a

  regs.a = mem.read8(0x8034);
  m.step(0x469c, 13); // 4699  ld a,(0x8034) -- score high BCD byte
  regs.adc(regs.b);
  m.step(0x469d, 4); // 469c  adc a,b -- + the carry the low-byte daa left
  regs.daa();
  m.step(0x469e, 4); // 469d  daa -- BCD-correct the high byte
  mem.write8(0x8034, regs.a);
  m.step(0x46a1, 13); // 469e  ld (0x8034),a

  // 46a1  jr 0x46af -- TAIL into sub_46af; it pushes nothing, so sub_46af's own
  // ret returns to OUR caller. Return its result straight through (single pop).
  m.step(0x46af, 12);
  return m.call(0x46af);
}
