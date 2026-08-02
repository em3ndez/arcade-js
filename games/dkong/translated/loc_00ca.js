// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * loc_00ca  (ROM 0x00CA rst-0x28 table) — routes the NMI game-state target (from 0x6005) to its handler.
 *   0 -> 0x01c3   1 -> 0x073c   2 -> 0x08b2   3 -> 0x06fe
 * Bounds are exact -- the pushed continuation 0x00D2 is the first byte after
 * the table.
 */
export function loc_00ca(m, target, site = "0x00CA (NMI game state)") {
  if (m.overrides && m.overrides.has(target)) return m.overrides.get(target)(m);
  if (target === 0x01c3) return m.call(0x01c3);
  if (target === 0x073c) return m.call(0x073c);
  if (target === 0x0779) return m.call(0x0779);
  if (target === 0x0763) return m.call(0x0763);
  if (target === 0x08b2) return m.call(0x08b2); // game state 2 (GAMEPLAY) entry
  if (target === 0x08ba) return m.call(0x08ba); // 0x08B6 table[0] (0x600A==0)
  if (target === 0x08f8) return m.call(0x08f8); // 0x08B6 table[1] (0x600A==1)
  if (target === 0x06fe) return m.call(0x06fe); // game state 3, 0x0702 table by 0x600A
  if (target === 0x0986) return m.call(0x0986); // 0x0702 table entries (0x600A index)
  if (target === 0x09ab) return m.call(0x09ab);
  if (target === 0x09d6) return m.call(0x09d6);
  if (target === 0x09fe) return m.call(0x09fe);
  if (target === 0x0a1b) return m.call(0x0a1b);
  if (target === 0x0a37) return m.call(0x0a37);
  if (target === 0x0a63) return m.call(0x0a63);
  if (target === 0x0a76) return m.call(0x0a76);
  if (target === 0x0bda) return m.call(0x0bda);
  if (target === 0x0a8a) return m.call(0x0a8a); // 0x0A7A table (0x6385 seq)
  if (target === 0x0abf) return m.call(0x0abf);
  if (target === 0x0ae8) return m.call(0x0ae8);
  if (target === 0x0b06) return m.call(0x0b06);
  if (target === 0x0b68) return m.call(0x0b68);
  if (target === 0x0bb3) return m.call(0x0bb3);
  if (target === 0x3069) return m.call(0x3069); // shared rate-limiter (0x0A7A idx3/5)
  // -- full dispatch-table wiring (0x0748 state-1 sub, 0x0702 idx10+, 0x1283, 0x2874, 0x1648) --
  if (target === 0x07c3) return m.call(0x07c3);
  if (target === 0x07cb) return m.call(0x07cb);
  if (target === 0x084b) return m.call(0x084b);
  if (target === 0x0c91) return m.call(0x0c91); // nmi-local
  if (target === 0x127c) return m.call(0x127c);
  if (target === 0x128b) return m.call(0x128b);
  if (target === 0x12ac) return m.call(0x12ac);
  if (target === 0x12de) return m.call(0x12de);
  if (target === 0x17b6) return m.call(0x17b6);
  if (target === 0x1839) return m.call(0x1839);
  if (target === 0x186f) return m.call(0x186f);
  if (target === 0x1880) return m.call(0x1880);
  if (target === 0x18c6) return m.call(0x18c6);
  if (target === 0x2880) return m.call(0x2880);
  if (target === 0x28b0) return m.call(0x28b0);
  if (target === 0x28e0) return m.call(0x28e0);
  if (target === 0x2901) return m.call(0x2901);
  // -- L2 board-advance: loc_1615 + its 0x1623/0x1637 sub-tables --
  if (target === 0x1615) return m.call(0x1615); // 0x0702 table idx 0x16 (0x600A=0x16)
  if (target === 0x1654) return m.call(0x1654);
  if (target === 0x1670) return m.call(0x1670);
  if (target === 0x168a) return m.call(0x168a);
  if (target === 0x1732) return m.call(0x1732);
  if (target === 0x1757) return m.call(0x1757);
  if (target === 0x178e) return m.call(0x178e);
  if (target === 0x16a3) return m.call(0x16a3);
  if (target === 0x16bb) return m.call(0x16bb);
  if (target === 0x123c) return m.call(0x123c);
  if (target === 0x1977) return m.call(0x1977); // game state 1 sub-state (0x0748 table) -- THE FINALE reach-mover
  if (target === 0x197a) return m.call(0x197a); // game state 3 gameplay (0x0702 table @0x600A) enters the cascade at 0x197A (skips handler_1977's 0x1977 sub_21ee call)
  if (target === 0x07cb) return m.call(0x07cb); // 0x0748 task table (dw 0x07cb @0x0754)
  // The 0x3110 guard family -- SKIP-CAPABLE targets reached via sub_30fa's
  // rst 0x28. These return a boolean ("should the dispatch caller continue?"),
  // which sub_0028 now propagates. Adding them relies on nothing new: the arms
  // above already `return`.
  if (target === 0x3110) return m.call(0x3110);
  if (target === 0x311b) return m.call(0x311b);
  if (target === 0x3126) return m.call(0x3126);
  if (target === 0x3131) return m.call(0x3131);
  // entry_3e88's rst 0x28 table (base 0x3E8D). Reached ONLY through that
  // dispatcher, which is untranslated (called from 0x286B), so these arms never
  // fire on the live NMI/substate/sub_30fa paths.
  if (target === 0x3e99) return m.call(0x3e99);
  if (target === 0x28b0) return m.call(0x28b0);
  if (target === 0x28e0) return m.call(0x28e0);
  if (target === 0x2901) return m.call(0x2901);
  if (target === 0x2880) return m.call(0x2880); // sub_286f's 0x2874 collision table (0x6227)
  if (target === 0x138f) return m.call(0x138f); // 0x0702 table idx16
  if (target === 0x13a1) return m.call(0x13a1); // 0x0702 table idx17 -- twin of 138f (table-audit)
  if (target === 0x13aa) return m.call(0x13aa); // 0x0702 table idx18
  if (target === 0x13bb) return m.call(0x13bb); // 0x0702 table idx19
  if (target === 0x141e) return m.call(0x141e); // 0x0702 table idx20
  if (target === 0x1486) return m.call(0x1486); // 0x0702 table idx21 -- bonus-item phase handler
  if (target === 0x196b) return m.call(0x196b); // 0x0702 table idx23 -- computed phase transition
  if (target === 0x12f2) return m.call(0x12f2); // 0x0702 table idx14 -- counter-gated state setup (reached at play start)
  if (target === 0x1344) return m.call(0x1344); // 0x0702 table idx15 -- twin of loc_12f2
  throw new NotImplemented(
    `handler at ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(reached via rst 0x28 table at ${site})`,
  );
}
