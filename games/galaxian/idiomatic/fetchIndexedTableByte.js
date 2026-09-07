// SPDX-License-Identifier: GPL-3.0-only
/**
 * fetchIndexedTableByte -- the "n-th entry of this ROM table" primitive (Z80 RST 20 vector).
 *
 * WHAT IT IS
 *   One of the shared page-zero verbs. Given a table base pointer (HL) and an 8-bit index (A), it adds
 *   the index to the pointer -- carrying properly into the high byte so the lookup survives a page
 *   crossing -- reads the byte at the resulting address, and returns it. It leaves the advanced pointer in
 *   HL so a caller that wants to keep reading down the table can continue from there.
 *
 * ROLE IN THE MACHINE
 *   This is the standard indexed table read reached constantly by the rest of the game (ROM data tables,
 *   coinage/score/spawn tables, and so on). It takes no work-RAM state of its own; base and index are the
 *   caller's registers and the read target is ROM/RAM at base+index.
 *
 * ROM 0x0020 (RST 20).  Grounding: [seen]. No named cells -- it operates purely on the passed pointer.
 *
 * LIVE-OUT: m.regs.hl = base + index (mod 0x10000) and m.regs.a = the fetched byte (also the return value).
 */

export function fetchIndexedTableByte(m, index = m.regs.a, base = m.regs.hl) {
  // Advance the pointer by the index, wrapping within 16 bits so a page crossing carries into the high byte.
  const addr = (base + index) % 65536; // pointer advance wraps within 16 bits
  // Publish the advanced pointer in HL and return the byte read at that address in A.
  return (m.regs.hl = addr, m.regs.a = m.mem8[addr]);
}
