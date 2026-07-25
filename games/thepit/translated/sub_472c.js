// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_472c  (ROM 0x472C-0x4784, The Pit) -- redraws both players' HUD score
 * displays, then paints two colour-RAM HUD columns.
 *
 * Saves the active player index (0x8002) in E, then for player 1 (0x8002=1) and
 * player 2 (0x8002=2) in turn: copies that player's state into the shared slot
 * (call 0x4644), draws its four score digits into VRAM (call 0x46AF), and blanks
 * the two cells one and two rows above the score column ((ix-0x20)=(ix-0x40)=0 --
 * IX is whatever sub_46AF left, its VRAM base). It then restores 0x8002 = E and
 * re-runs the state copy (0x4644) for the active player. The player-count byte at
 * 0x8001 selects the HUD variant: `dec a; cp 2; jr nc` -> (0x8001) >= 3 (or 0)
 * calls 0x48E5, otherwise (1 or 2 players) calls 0x47E1. Finally it paints colour
 * 0x02 UP two colour-RAM columns (0x8BA1 for 9 cells, 0x8961 for 10), stride
 * -0x20 via `add hl,de` with DE = 0xFFE0.
 *
 * sub_472c:
 *   472c  3a 02 80     ld   a,(0x8002)      ; A = active player index
 *   472f  5f           ld   e,a             ; save it in E
 *   4730  3e 01        ld   a,0x01
 *   4732  32 02 80     ld   (0x8002),a      ; select player 1
 *   4735  cd 44 46     call 0x4644          ; copy player 1 state -> shared slot
 *   4738  cd af 46     call 0x46af          ; draw player 1 score digits
 *   473b  dd 36 e0 00  ld   (ix-0x20),0x00  ; blank cell one row up
 *   473f  dd 36 c0 00  ld   (ix-0x40),0x00  ; blank cell two rows up
 *   4743  3e 02        ld   a,0x02
 *   4745  32 02 80     ld   (0x8002),a      ; select player 2
 *   4748  cd 44 46     call 0x4644          ; copy player 2 state -> shared slot
 *   474b  cd af 46     call 0x46af          ; draw player 2 score digits
 *   474e  dd 36 e0 00  ld   (ix-0x20),0x00
 *   4752  dd 36 c0 00  ld   (ix-0x40),0x00
 *   4756  7b           ld   a,e             ; restore active player index
 *   4757  32 02 80     ld   (0x8002),a
 *   475a  cd 44 46     call 0x4644          ; copy active player state -> shared slot
 *   475d  3a 01 80     ld   a,(0x8001)      ; player count
 *   4760  3d           dec  a
 *   4761  fe 02        cp   0x02
 *   4763  30 05        jr   nc,0x476a       ; (count-1) >= 2  -> 0x48E5
 *   4765  cd e1 47     call 0x47e1          ; 1-2 player HUD
 *   4768  18 03        jr   0x476d
 * loc_476a:
 *   476a  cd e5 48     call 0x48e5          ; 3+ player HUD
 * loc_476d:
 *   476d  21 a1 8b     ld   hl,0x8ba1       ; first colour column
 *   4770  11 e0 ff     ld   de,0xffe0       ; -0x20 per pass (one row up)
 *   4773  3e 02        ld   a,0x02          ; colour 0x02
 *   4775  06 09        ld   b,0x09          ; 9 cells
 * loc_4777:
 *   4777  77           ld   (hl),a
 *   4778  19           add  hl,de
 *   4779  10 fc        djnz 0x4777
 *   477b  21 61 89     ld   hl,0x8961       ; second colour column
 *   477e  06 0a        ld   b,0x0a          ; 10 cells (A still 0x02)
 * loc_4780:
 *   4780  77           ld   (hl),a
 *   4781  19           add  hl,de
 *   4782  10 fc        djnz 0x4780
 *   4784  c9           ret
 *
 * IX is inherited (set by sub_46AF); `ld`/`add hl,de`/`djnz` flag semantics match
 * sub_46f4's sibling loops -- the flags at `ret` are the last `add hl,de`'s. One
 * unconditional `ret`, stack balanced.
 */
export function sub_472c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8002); // 472c  ld a,(0x8002)
  m.step(0x472f, 13);
  regs.e = regs.a; // 472f  ld e,a -- save active player index
  m.step(0x4730, 4);
  regs.a = 0x01; // 4730  ld a,0x01
  m.step(0x4732, 7);
  mem.write8(0x8002, regs.a); // 4732  ld (0x8002),a -- select player 1
  m.step(0x4735, 13);

  m.push16(0x4738); // 4735  call 0x4644 -- return addr = 0x4738
  m.step(0x4644, 17);
  m.call(0x4644);

  m.push16(0x473b); // 4738  call 0x46af -- return addr = 0x473b
  m.step(0x46af, 17);
  m.call(0x46af);

  mem.write8((regs.ix - 0x20) & 0xffff, 0x00); // 473b  ld (ix-0x20),0x00
  m.step(0x473f, 19);
  mem.write8((regs.ix - 0x40) & 0xffff, 0x00); // 473f  ld (ix-0x40),0x00
  m.step(0x4743, 19);

  regs.a = 0x02; // 4743  ld a,0x02
  m.step(0x4745, 7);
  mem.write8(0x8002, regs.a); // 4745  ld (0x8002),a -- select player 2
  m.step(0x4748, 13);

  m.push16(0x474b); // 4748  call 0x4644 -- return addr = 0x474b
  m.step(0x4644, 17);
  m.call(0x4644);

  m.push16(0x474e); // 474b  call 0x46af -- return addr = 0x474e
  m.step(0x46af, 17);
  m.call(0x46af);

  mem.write8((regs.ix - 0x20) & 0xffff, 0x00); // 474e  ld (ix-0x20),0x00
  m.step(0x4752, 19);
  mem.write8((regs.ix - 0x40) & 0xffff, 0x00); // 4752  ld (ix-0x40),0x00
  m.step(0x4756, 19);

  regs.a = regs.e; // 4756  ld a,e -- restore active player index
  m.step(0x4757, 4);
  mem.write8(0x8002, regs.a); // 4757  ld (0x8002),a
  m.step(0x475a, 13);

  m.push16(0x475d); // 475a  call 0x4644 -- return addr = 0x475d
  m.step(0x4644, 17);
  m.call(0x4644);

  regs.a = mem.read8(0x8001); // 475d  ld a,(0x8001) -- player count
  m.step(0x4760, 13);
  regs.a = regs.dec8(regs.a); // 4760  dec a
  m.step(0x4761, 4);
  regs.cp(0x02); // 4761  cp 0x02 -- carry set iff (count-1) < 2
  m.step(0x4763, 7);

  if (regs.fNC) {
    // 4763  jr nc,0x476a taken -- (count-1) >= 2  -> 3+ player HUD
    m.step(0x476a, 12);
    m.push16(0x476d); // 476a  call 0x48e5 -- return addr = 0x476d
    m.step(0x48e5, 17);
    m.call(0x48e5);
  } else {
    // 4763  jr nc not taken -- 1-2 players
    m.step(0x4765, 7);
    m.push16(0x4768); // 4765  call 0x47e1 -- return addr = 0x4768
    m.step(0x47e1, 17);
    m.call(0x47e1);
    m.step(0x476d, 12); // 4768  jr 0x476d
  }

  // loc_476d -- paint colour 0x02 UP the first colour column (9 cells).
  regs.hl = 0x8ba1; // 476d  ld hl,0x8ba1
  m.step(0x4770, 10);
  regs.de = 0xffe0; // 4770  ld de,0xffe0 -- -0x20 per pass
  m.step(0x4773, 10);
  regs.a = 0x02; // 4773  ld a,0x02 -- colour 0x02
  m.step(0x4775, 7);
  regs.b = 0x09; // 4775  ld b,0x09
  m.step(0x4777, 7);

  // loc_4777
  for (;;) {
    mem.write8(regs.hl, regs.a); // 4777  ld (hl),a
    m.step(0x4778, 7);
    regs.addHl(regs.de); // 4778  add hl,de -- sets H/N/C, keeps S/Z/PV
    m.step(0x4779, 11);
    // 4779  djnz 0x4777 -- B-- (no flags), loop while non-zero
    if (regs.djnz() !== 0) {
      m.step(0x4777, 13); // taken -> loc_4777
    } else {
      m.step(0x477b, 8); // not taken -> fall through
      break;
    }
  }

  regs.hl = 0x8961; // 477b  ld hl,0x8961 -- second colour column
  m.step(0x477e, 10);
  regs.b = 0x0a; // 477e  ld b,0x0a  (A still 0x02)
  m.step(0x4780, 7);

  // loc_4780 -- paint colour 0x02 UP the second colour column (10 cells).
  for (;;) {
    mem.write8(regs.hl, regs.a); // 4780  ld (hl),a
    m.step(0x4781, 7);
    regs.addHl(regs.de); // 4781  add hl,de
    m.step(0x4782, 11);
    // 4782  djnz 0x4780
    if (regs.djnz() !== 0) {
      m.step(0x4780, 13); // taken -> loc_4780
    } else {
      m.step(0x4784, 8); // not taken -> fall through
      break;
    }
  }

  m.ret(); // 4784  ret -- unconditional, 10 T
}
