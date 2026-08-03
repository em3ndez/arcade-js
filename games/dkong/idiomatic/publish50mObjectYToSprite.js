// SPDX-License-Identifier: GPL-3.0-only
/**
 * publish50mObjectYToSprite — mirror the byte at a source pointer into one of two sprite slots,
 * selected by bit 3 of the pointer.  ROM 0x22BD.
 *
 * Reads the byte at the source address and stores it into one of two fixed cells in
 * the sprite shadow buffer. Bit 3 of the source address's low byte chooses the slot:
 * clear -> the lower-ADDRESSED cell (0x6947), set -> the higher-addressed one (0x694b).
 * ("Lower/higher" here is about addresses, not the screen.) Both cells are the +3 (Y)
 * field of a 4-byte sprite record inside SPRITE_BUFFER — records 17 and 18, the two
 * slots at addresses just below Mario's (0x694C) — so the store refreshes an on-screen
 * sprite's Y straight from the source byte. Larger Y is lower on screen, so raising
 * the copied byte drops the sprite down the display.
 *
 * Its two callers — slide50mObjectDown (ROM 0x2259) and raise50mObjectAndPark (ROM 0x22A2),
 * the moving arms of the 50m object state machine — both hand it a pointer to an object
 * record's position counter (base+3), so the drawn sprite tracks that counter. The
 * selector works because the two records' bases differ by 8, which makes bit 3 of the
 * low byte the record index.
 *
 * NAME: promoted from loc_22bd in understanding pass 15 (proposer != confirmer; both
 * derivations landed on "publish the object's Y into its sprite"). The identity is
 * measured from OUTSIDE
 * the routine (R5): on a live 50m board — RUN-P2's 6810 board-2 frames — record A's +3 tracked
 * 0x6947 on 6810/6810 and record B's +3 tracked 0x694b on 6810/6810, with the same 6810/6810
 * identity holding for the records' X bytes against 0x6944/0x6948. ★ Read that as the identity,
 * NOT as a same-frame equality: the convention source (raise50mObjectAndPark.js's VERTICAL
 * CONVENTION block) records the record-to-sprite identity as LAGGED — +3 at frame N equals the
 * sprite cell at N+1 on 7408/7409, while the exact same-frame form holds on only 7009/7410,
 * because the sprite buffer reflects the record as of the previous frame at that run's sampling
 * point. The per-board control is just as sharp —
 * both sprite records are all-zero on boards 1 and 4 and seeded-but-frozen on board 3.
 * A sprite-blanking A/B then isolated a single clean 10x16 box at screen (15,96)-(25,112)
 * and (199,96)-(209,112), tile 0x46 / attr 0x03: two sprites, one per record, at the far
 * left and far right of the playfield. SPRITE_BUFFER (0x6900) is a named cell in ram.js and
 * both call sites are English-named routines.
 *
 * WHAT THE NAME DOES NOT CLAIM: the name says "Y", not what the sprite depicts. The sprite
 * itself IS isolated — the box measured above, tile 0x46 / attr 0x03 — and it reads as a
 * ladder graphic, side-rails with rungs, whose upper section vanishes when the record is
 * blanked while static tilemap rungs remain below. Pass 15's blind confirmer named this
 * cluster for a moving ladder on three code strands plus that image. The names here still
 * say "object" for one reason: "ladder" is a reading of a picture, and which of the 50m
 * cast's ladders this is — retracting, or something else that travels — was not settled.
 *
 * A LEAF: reads one source byte, writes one sprite cell; calls nothing, returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22bd.test.js.
 * GATE:     crafted, exhaustive by factorisation — attract never dispatches 0x22BD (0 in
 *           3000 frames, since reconfirmed at 0 across 24,243), so no real capture was
 *           available when this gate was built. ★ Real dispatches DO exist now — the
 *           pass-14 grounding watched this mirror run for RUN-P2's 6810 board-2 frames — and this
 *           gate replays none of them; that is a coverage hole, not an impossibility. What
 *           it does prove: the observable space is tiny and is swept in full on real
 *           attract-base states. (A) all 256 source-pointer low
 *           bytes with a fixed value cover the destination selection for every low byte;
 *           (B) all 256 byte values on each arm (bit 3 clear / set) cover the exact copy
 *           into both cells. Teeth: a wrong-selector-bit twin, an inverted-selector twin,
 *           and a value-corrupting twin.
 * LIVE-OUT: memory-only — the single store is the only observable effect. Both callers
 *           immediately overwrite the accumulator that held the copied byte (their
 *           `regs.a = 0x78` / `0x68` end-of-travel compare right after the call), never read
 *           the destination address it computes, and reuse the source pointer, which this
 *           routine leaves untouched; the oracle's residual registers/flags and its terminal
 *           `ret` are dead ABI.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js. The two destination cells (0x6947, 0x694b)
 *           are the +3 (Y) field of records 17/18 inside it and have no individual ram.js
 *           name — kept as local consts for the lead to name later. The record bases
 *           0x6944/0x6948 are the two 50m-object sprite records (measured tracking the
 *           object records' X/Y on 6810/6810 board-2 frames of RUN-P2 — the lagged identity
 *           above, not a same-frame one); ram.js does not name them yet.
 */

import { SPRITE_BUFFER } from "./ram.js";

// The two candidate destinations: the +3 (Y) field of two adjacent 4-byte sprite records
// inside SPRITE_BUFFER — records 17 and 18, at addresses just below Mario's record at
// 0x694C. Bit 3 of the source pointer's low byte picks which one is refreshed (the two
// object records' bases differ by 8, so that bit is the record index). Neither cell has its
// own name in ram.js.
const DEST_BIT3_CLEAR = SPRITE_BUFFER + 17 * 4 + 3; // 0x6947
const DEST_BIT3_SET = SPRITE_BUFFER + 18 * 4 + 3; // 0x694b

/**
 * @param {object} m       the machine (uses m.mem only).
 * @param {number} srcAddr the source pointer — the byte read is copied to the selected slot,
 *                         and bit 3 of this address's low byte selects which slot.
 * @returns {void}
 */
export function publish50mObjectYToSprite(m, srcAddr) {
  const { mem } = m;

  const value = mem.read8(srcAddr);
  const dest = (srcAddr & 0x08) !== 0 ? DEST_BIT3_SET : DEST_BIT3_CLEAR;
  mem.write8(dest, value);
}
