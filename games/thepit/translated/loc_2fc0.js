// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2fc0  (ROM 0x2fc0-0x2fe2, The Pit) -- the per-frame phase clock for a
 * background animation subsystem: decrement the phase counter (0x80e3) and route
 * on the result to one of three shared continuations. Entered from loc_2f71's
 * three `jr/jp ...,0x2fc0` short-circuits (the "nothing to update this frame"
 * exits), so it runs once per game frame that reaches it.
 *
 *   A = --(0x80e3)                      -- advance the phase countdown
 *   if A != 0:                          -- countdown still running (loc_2fde)
 *       if (A & 3) != 0:  -> loc_3029   -- off-phase: skip the wave step, go to tail
 *       else:             -> loc_2fe3   -- on-phase (every 4th frame): the wave body
 *   else:                               -- countdown expired: reload + toggle
 *       (0x80e3) = 8                    -- reload the phase countdown to 8
 *       toggle (0x80dc) between 0x38 <-> 0x39   -- the two-frame tile flip
 *       -> loc_2fd9 (commits the toggled tile in A, then tail-jumps loc_2fe3)
 *
 * BOUNDARIES / DELEGATION (never inline a byte another routine owns):
 *   - loc_2fd9 is its OWN registered routine (0x2fd9-0x2fdd, the (0x80dc) commit
 *     tail); both the `jr nz,0x2fd9` arm and the fall-through after `ld a,0x39`
 *     reach it, so this routine DELEGATES `return m.call(0x2fd9)` rather than
 *     duplicating its bytes.
 *   - loc_2fe3 is entered here (loc_2fde's `jp nz` NOT taken -> fall-through) AND
 *     from loc_2fd9's `jr 0x2fe3`, so it is a shared routine boundary: delegate.
 *   - loc_3029 is the shared exit tail (also reached from inside loc_2fe3's body):
 *     delegate.
 * All three delegations are tail-jumps: this routine has NO ret of its own, so the
 * callee's ret returns to OUR caller (a trailing m.ret would double-pop). loc_2fde
 * (0x2fde-0x2fe2) is an internal-only label -- reached solely from this routine's
 * `jr nz,0x2fde` -- so it is inlined, not delegated. Every store is to work RAM
 * (0x8000-0x87ff), which takes no write-bus offset.
 * (Role is best-effort from the code; the addresses, arithmetic, gate and control
 * flow are exact.)
 *
 * loc_2fc0:
 *   2fc0  3a e3 80     ld   a,(0x80e3)
 *   2fc3  3d           dec  a
 *   2fc4  32 e3 80     ld   (0x80e3),a
 *   2fc7  20 15        jr   nz,0x2fde
 *   2fc9  3e 08        ld   a,0x08
 *   2fcb  32 e3 80     ld   (0x80e3),a
 *   2fce  3a dc 80     ld   a,(0x80dc)
 *   2fd1  47           ld   b,a
 *   2fd2  3e 38        ld   a,0x38
 *   2fd4  b8           cp   b
 *   2fd5  20 02        jr   nz,0x2fd9      ; -> loc_2fd9 (own routine)
 *   2fd7  3e 39        ld   a,0x39
 *                      ; fall into loc_2fd9 (own routine)
 * loc_2fde:            ; internal-only label, inlined
 *   2fde  e6 03        and  0x03
 *   2fe0  c2 29 30     jp   nz,0x3029      ; -> loc_3029 (own routine)
 *                      ; fall into loc_2fe3 (own routine)
 */
export function loc_2fc0(m) {
  const { regs, mem } = m;

  // 2fc0  ld a,(0x80e3) -- load the animation phase countdown
  regs.a = mem.read8(0x80e3);
  m.step(0x2fc3, 13);
  // 2fc3  dec a -- advance it (dec8 sets Z; the jr below branches on it)
  regs.a = regs.dec8(regs.a);
  m.step(0x2fc4, 4);
  // 2fc4  ld (0x80e3),a -- write the decremented counter back
  mem.write8(0x80e3, regs.a);
  m.step(0x2fc7, 13);
  // 2fc7  jr nz,0x2fde -- counter not expired: take the still-running path (loc_2fde)
  if (regs.fNZ) {
    m.step(0x2fde, 12); // jr nz taken -> loc_2fde

    // loc_2fde (internal-only label, inlined):
    // 2fde  and 0x03 -- every-4th-frame gate on the running counter
    regs.and(0x03);
    m.step(0x2fe0, 7);
    // 2fe0  jp nz,0x3029 -- off-phase: skip the wave step, jump straight to the tail
    if (regs.fNZ) {
      m.step(0x3029, 10); // jp cc,nn is 10 T taken (NOT 12 like jr) -> loc_3029 (own routine)
      return m.call(0x3029);
    }
    // on-phase (A & 3 == 0): jp NOT taken -> fall into the wave body loc_2fe3
    m.step(0x2fe3, 10); // jp cc,nn is 10 T not-taken too; PC advances to 0x2fe3
    return m.call(0x2fe3);
  }
  m.step(0x2fc9, 7); // jr nz NOT taken -> reload branch (counter expired)

  // 2fc9  ld a,0x08
  regs.a = 0x08;
  m.step(0x2fcb, 7);
  // 2fcb  ld (0x80e3),a -- reload the phase countdown to 8
  mem.write8(0x80e3, regs.a);
  m.step(0x2fce, 13);
  // 2fce  ld a,(0x80dc) -- the current animation tile byte
  regs.a = mem.read8(0x80dc);
  m.step(0x2fd1, 13);
  // 2fd1  ld b,a
  regs.b = regs.a;
  m.step(0x2fd2, 4);
  // 2fd2  ld a,0x38
  regs.a = 0x38;
  m.step(0x2fd4, 7);
  // 2fd4  cp b -- is the current tile already 0x38?
  regs.cp(regs.b);
  m.step(0x2fd5, 4);
  // 2fd5  jr nz,0x2fd9 -- tile != 0x38: keep A=0x38, commit via loc_2fd9
  if (regs.fNZ) {
    m.step(0x2fd9, 12); // jr nz taken -> loc_2fd9 (own routine); A stays 0x38
    return m.call(0x2fd9);
  }
  m.step(0x2fd7, 7); // jr nz NOT taken -> fall to 0x2fd7 (tile was 0x38, flip to 0x39)
  // 2fd7  ld a,0x39
  regs.a = 0x39;
  m.step(0x2fd9, 7); // fall into loc_2fd9 (own routine): it stores A to (0x80dc)
  return m.call(0x2fd9);
}
