// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_186a  (ROM 0x186A-0x186E, The Pit) -- selects sprite/tile frame id 0x34 for the
 * actor (stores it at 0x8069) and FALLS THROUGH into the shared position/pointer builder
 * loc_186f. There is no jump byte -- `ld (0x8069),a` (0x186c, three bytes) is immediately
 * followed by loc_186f at 0x186f, so control merges by fall-through, not a `jp`.
 *
 *   186a  3e 34        ld   a,0x34          ; frame/sprite id 0x34
 *   186c  32 69 80     ld   (0x8069),a      ; -> actor frame byte
 *                      -- falls through into loc_186f (no jump byte) --
 *
 * WHAT IT DOES: this is one of a family of thin prologues that each pick a different
 * frame id into 0x8069 and then hand off to a shared tail. Its sibling loc_1864 picks
 * 0x32 or 0x33 (via `and 0x02`) and `jp 0x1b5b`; loc_186a unconditionally picks 0x34 and
 * merges into loc_186f, which recomputes the actor's on-screen video-RAM cell pointer
 * (0x806e) from the position counters 0x8068/0x806b (+D), reads the tile there, and
 * dispatches on it. loc_186a is reached from the movement dispatcher at loc_13de
 * (`jp z,0x186a` when 0x80c1 == 1, with D preloaded from 0x806d) and from loc_1468
 * (`jp nz,0x186a` when L bit 2 is set). The whole job of THIS routine is: 0x8069 := 0x34.
 *
 * The fall-through discards no return address of its own, so loc_186f's own `ret` unwinds
 * to loc_186a's OWN caller. Modelled per the translation doc exactly like the `jp`-based / fall-through
 * siblings (loc_4ca3, loc_4cbf): `return m.call(0x186f)` with NO trailing m.ret -- a second
 * ret would double-pop. Because it is a fall-through there is no jump byte to charge, so
 * only `ld a,0x34` (7 T) and `ld (0x8069),a` (13 T) are charged locally before control
 * passes to loc_186f. Neither `ld a,n` nor `ld (nn),a` touches any flag, so the caller's F
 * reaches loc_186f unchanged. (Role read from the code; the constant, the store address,
 * the cycle charge and the control flow are exact.)
 */
export function loc_186a(m) {
  const { regs, mem } = m;

  // 186a  ld a,0x34 -- frame/sprite id 0x34 (no flags)
  regs.a = 0x34;
  m.step(0x186c, 7);

  // 186c  ld (0x8069),a -- store the frame id; PC now at 0x186f (work RAM, no bus offset)
  mem.write8(0x8069, regs.a);
  m.step(0x186f, 13);

  // Fall through into loc_186f: its ret returns to loc_186a's caller. Tail-jump idiom --
  // no push, no trailing m.ret (a second ret would double-pop).
  return m.call(0x186f);
}
