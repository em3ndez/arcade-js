// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInlineJumpTable — the `rst 0x28` inline-jump-table trampoline. ROM 0x0028.
 *
 * A caller does `rst 0x28` with the target index already in A, and lays a table of
 * 2-byte little-endian target addresses in ROM immediately AFTER the rst opcode.
 * The `rst`'s pushed return address therefore points AT that inline table, and this
 * routine's whole job is: recover that table base, read the word at table[A], and
 * jump to it. It is the shared computed-dispatch primitive behind every rst-0x28
 * site — the NMI game-state table (0x00CA), the in-game sub-state table (0x0702),
 * the opening-cutscene table (0x0A7A), the sub_30fa guard table (0x3104), and more —
 * so it is generic, steered only by the selector in A and the table base on the stack.
 *
 *   - `add a,a` doubles the selector to a byte offset. This is an 8-bit result:
 *     selector 0x80 wraps the offset to 0, so the address math is `base + (2*A & 0xff)`,
 *     NOT `base + 2*A`. Reproduced exactly here.
 *   - `pop hl` lifts the table base off the stack — this ONE stack read is the
 *     routine's genuine INPUT (the rst pushed the base as data), not call/return
 *     plumbing, and it advances SP past the consumed base.
 *   - the little-endian word at table[selector] is the target; `jp (hl)` dispatches.
 *
 * The register/flag state the hardware leaves at the `jp (hl)` (A = 2*selector,
 * HL = target, DE = &table[selector].hi, flags from `add a,a` / `add hl,de`) is the
 * handoff the dispatched arm may read, so it is reproduced byte-for-byte before the
 * dispatch. Those registers are live only INTO the arm (consumed within this call);
 * they are dead to this routine's own callers.
 *
 * The dispatch itself is genuine address-level computed control flow (a ROM table of
 * targets, some reached only here), so it stays routed through the still-oracle
 * generic dispatcher dispatchGameState rather than a JS function table — the one
 * place doc-06 keeps an address registry. dispatchGameState returns the arm's
 * skip-boolean for the skip-capable dispatch families (the 0x3110 guards); that
 * value is propagated to the caller unchanged.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0028.test.js.
 * GATE:     crafted-entry — real captured NMI/sub-state dispatches over attract
 *           (fresh clone each, oracle handler run in full) + an EXHAUSTIVE sweep of
 *           the selector byte 0..255 over five representative table bases for the
 *           arms/indices attract never reaches; teeth = the 16-bit-offset bug.
 * LIVE-OUT: memory + SP + the dispatch return boolean (the rst skip flag). The
 *           A/HL/DE/flag handoff is internal to the dispatched arm, not caller-live.
 * NAMES:    none — reads only the ROM jump table (ROM data addresses, kept hex) and
 *           the pushed table base off the stack; references no work-RAM name.
 */
import { dispatchGameState } from "../translated/dispatchGameState.js";

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
  return dispatchGameState(m, regs.hl, site);
}
