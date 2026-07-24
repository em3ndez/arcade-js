// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_004e — hand-optimized rewrite of the translated routine at ROM 0x004E,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It calls no ROM subroutine (the block copy is the Z80
 * `ldir` instruction, modelled here as a direct byte loop under ONE collapsed
 * charge rather than through m.ldirAt -- see CYCLES below), so nothing is reached
 * through `m.call` here. Only the RAM *name* SPRITE_OBJ_BLOCK is imported (from
 * ram.js).
 */

import { SPRITE_OBJ_BLOCK } from "./ram.js";

/**
 * sub_004e -- block-copy a 40-byte sprite-object template into SPRITE_OBJ_BLOCK.
 * [ROM 0x004E-0x0056]
 *
 *   004e  11 08 69     ld   de,0x6908       ; DE = SPRITE_OBJ_BLOCK (0x6908)
 *   0051  01 28 00     ld   bc,0x0028       ; BC = 0x28 = 40 bytes (10 records * 4)
 *   0054  ed b0        ldir                 ; copy (HL)->(DE), BC bytes
 *   0056  c9           ret
 *
 * A tiny, HEAVILY-SHARED leaf (17 call sites across state0.js + nmi.js): every
 * caller wanting to lay a fresh 10-record sprite-object group into the shadow
 * sprite buffer sets HL to its ROM template and calls here. The destination
 * (0x6908) and length (0x28) are hard-wired; only the SOURCE varies per caller.
 *
 * INPUTS
 *   HL  (register)  IMPLICIT INPUT -- the copy SOURCE. This routine never sets HL,
 *                   so the source address comes entirely from the caller (e.g.
 *                   loc_0abf supplies ROM 0x388C; loc_186f supplies ROM 0x3A1F).
 *                   The nine bytes here do NOT determine it.
 * OUTPUTS (RAM)
 *   0x6908-0x692F   the 40-byte destination (SPRITE_OBJ_BLOCK = SPRITE_BUFFER+8),
 *                   overwritten with the 40 source bytes.
 * OUTPUTS (registers, all left exactly where the copy leaves them, visible to caller)
 *   HL = HL_in + 0x28   (source advanced past the copied block)
 *   DE = 0x6930         (0x6908 + 0x28, dest advanced past the block)
 *   BC = 0
 *   A, IX, IY          untouched
 *
 * FLAGS: NONE are set. `ld de` / `ld bc` do not touch F, and the copy loop leaves F
 * alone -- so F (carry included) passes through from entry UNCHANGED, identically
 * on both sides. The oracle docstring's "PRESERVES CARRY" is exactly this
 * pass-through; whichever caller consumes the carry sees the same bit it had on
 * entry on both paths. The unit gate compares the whole register file, F included,
 * and confirms it.
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole routine: ld de,0x6908[10] +
 * ld bc,0x28[10] + ldir (39 iterations charged 21 t each + the 40th/exit charged
 * 16 t = 39*21+16 = 835) = 855 t, then `m.ret()` (10 t default) -- 865 t total,
 * exactly the oracle's (cross-checked against this file's own prior
 * per-instruction charges, all previously proven equal). The copy itself is done
 * as a direct byte loop (same memory-op order as the Z80 LDIR: write, then
 * advance HL/DE/BC) rather than through machine.js's m.ldirAt, since the whole
 * copy is now ONE charge rather than one m.step per byte. Total-preservation
 * keeps the caller's cycle clock exact; only the mid-routine PC snapshot an NMI
 * would observe is coarsened, same as any collapse.
 *
 * Of the 17 callers, at least one is a MAIN-LOOP task (loc_07cb, the per-frame
 * countdown-animation task, NMI mask ENABLED), so the vblank NMI can land inside
 * this routine; see the equivalence test for the (convergent, unconditionally)
 * gate this routine runs under.
 */
export function sub_004e(m) {
  const { regs, mem } = m;

  // ld de,0x6908 -- destination = SPRITE_OBJ_BLOCK (the 10-record sprite-object group).
  regs.de = SPRITE_OBJ_BLOCK;
  // ld bc,0x0028 -- copy length: 40 bytes = 10 records * 4 bytes each.
  regs.bc = 0x0028;

  // ldir -- copy 0x28 bytes (HL)->(DE), same memory-op order as the Z80 LDIR
  // (write, then advance HL/DE/BC each iteration). HL is the caller-supplied
  // SOURCE (implicit input; never set here).
  for (let i = 0; i < 0x28; i++) {
    mem.write8(regs.de, mem.read8(regs.hl));
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.de = (regs.de + 1) & 0xffff;
    regs.bc = (regs.bc - 1) & 0xffff;
  }
  m.step(0x0056, 855); // ld de,0x6908[10] + ld bc,0x28[10] + ldir[835]

  // ret -- unconditional, stack balanced, carry preserved.
  m.ret(); // 10 t (default) -- total 865 t
}
