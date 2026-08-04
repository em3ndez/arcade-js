// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInlineJumpTable — the inline-jump-table trampoline: dispatch on a selector byte to one of
 * a list of target addresses laid down immediately after the call site.
 *
 * A caller reaches here through a one-byte restart instruction with the target index already in the
 * accumulator, and lays a table of 2-byte little-endian target addresses immediately AFTER that
 * opcode. The pushed return address therefore points AT the table, and this routine's whole job is:
 * recover that table base, read the word at table[selector], and jump to it. It is the shared
 * computed-dispatch primitive behind every such site in the game — the per-frame game-state table,
 * the in-game sub-state table, the opening-cutscene table, the difficulty-selected guard table and
 * more — so it is generic, steered only by the selector and by the table base on the stack.
 *
 *   - Doubling the selector into a byte offset is an 8-BIT result: a selector of 0x80 wraps the
 *     offset back to 0, so the address math is `base + (2*selector & 0xff)`, NOT
 *     `base + 2*selector`. Reproduced exactly.
 *   - Lifting the table base off the stack is this routine's genuine INPUT — the caller pushed it
 *     as DATA, not as return plumbing — and consuming it is what advances the stack pointer past it.
 *   - The little-endian word at table[selector] is the target, and control transfers there.
 *
 * The register and flag state left at the transfer — accumulator = 2*selector, the target address,
 * the address of the selected entry's high byte, and the flags the two adds set — is the hand-off
 * the dispatched arm may read, so it is reproduced byte-for-byte before the transfer. All of it is
 * live only INTO the arm, and dead to this routine's own callers.
 *
 * The dispatch itself is genuine address-level computed control flow — a table of targets, some
 * reached only from here — so it stays routed through the generic address dispatcher rather than
 * being flattened into a JS function table. That dispatcher hands back the arm's skip-boolean for
 * the skip-capable dispatch families, and this routine propagates it to its caller unchanged.
 *
 * Reads: the table base off the stack, and the two target bytes at the selected entry. Writes:
 * nothing of its own — everything observable is written by the dispatched arm.
 * LIVE-OUT: the stack pointer past the consumed base, the arm's memory writes, and the arm's skip
 * boolean.
 */
import { loc_00ca } from "../translated/loc_00ca.js";

export function dispatchInlineJumpTable(m, site = "0x00CA (NMI game state)") {
  const { regs, mem } = m;

  // add a,a — double the selector into a byte offset (8-bit: 0x80 wraps to 0), and
  // leave A + flags exactly as the hardware does for the dispatched arm.
  regs.add(regs.a);

  // pop hl — the rst pushed the inline table's base (its own return address) as data;
  // recover it and step SP past the consumed base.
  regs.hl = m.pop16();

  // ld e,a / ld d,0 / add hl,de — HL = base + offset = &table[selector] (16-bit add,
  // sets H/C for the arm).
  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de);

  // ld e,(hl) / inc hl / ld d,(hl) — read the little-endian target word into DE.
  regs.e = mem.read8(regs.hl);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.d = mem.read8(regs.hl);

  // ex de,hl — HL = target (jp (hl)); DE keeps &table[selector].hi.
  regs.exDeHl();

  // jp (hl) — dispatch the computed target and propagate the arm's skip-boolean.
  return loc_00ca(m, regs.hl, site);
}
