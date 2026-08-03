// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_24b4 — retire an object that has reached the bottom of the playfield inside a narrow
 * column band: free its slot, blank its column, sound the impact, arm two mode flags, and hand
 * the record to the shared object-sprite tail INSTEAD OF returning to the caller.  ROM 0x24B4.
 *
 * Three gates in a row, each of which returns and leaves everything alone:
 *   - the record's OBJ_Y must have reached 232. Larger Y is LOWER on screen, and that is not
 *     assumed here: ram.js records the transitive path OBJ_Y -> the object's staged sprite byte
 *     +3, and raise50mObjectAndPark's VERTICAL CONVENTION block grounds that byte 1:1 against
 *     image rows under real MAME, larger lower. So 232 is near the bottom of a 256-row frame.
 *   - its OBJ_X must lie in 32..41, a ten-column band. Both ends are tested against the SAME
 *     byte, so the band is a range test, not two independent limits.
 * Past all three, the object is retired: OBJ_ACTIVE and OBJ_X are both zeroed (the same
 * free-the-slot-and-blank-it pairing loc_2104 makes on its own retirement arm), the sound
 * latch at SND_TRIGGER+2 is asserted for three frames, and control leaves for good.
 *
 * TWO MODE FLAGS ARE ARMED HERE, and they are the reason this routine is more than a bounds
 * check. Both are latches other routines read, not values this one consumes:
 *   - only for a record whose kind field is non-zero, the phase byte at 0x62B9 is set to
 *     bit0|bit1 — the pair that animateFixedHazardAndReleaseFire reads as "keep going" plus "take the second arm",
 *     the arm which runs a countdown and eventually raises EVENT_REQ_313C, the object-insert
 *     request. So the retirement of one kind of object is what starts something else.
 *   - a ONE-SHOT latch at 0x6348 is set to 1 the first time this ever fires, and never touched
 *     again while it stays set. Its two readers both treat CLEAR as the simple early-game
 *     behaviour and SET as the difficulty-graded one (loc_22cb picks object velocity from the
 *     level while clear and from DIFFICULTY once set; startBarrelDescentAtLadder advances a spawn immediately
 *     while clear and runs the position/input/throttle grading once set).
 *
 * WHAT THIS RESTS ON, stated because the paragraph above is the whole reason to read this file.
 * The two latch effects are read out of the FROZEN oracles and the shipped idiomatic files of
 * their readers, not derived here. The one-shot's exclusivity is MEASURED rather than argued: a
 * write tap over an 8000-frame attract run saw 0x6348 set to 1 only from inside this routine (3
 * writes) and cleared to 0 only from outside it (4 writes) — this arms it, board setup resets
 * it. The impact sound is ls259.6h bit 2, which audio/README.md names `boom` from the MAME
 * driver plus real ROM write traces, and lists "a barrel dropping into the oil drum" among the
 * events that fire it; that is CONSISTENT with a bottom-of-screen retirement in a fixed column
 * band, but the README lists two other uses for the same line, so it corroborates rather than
 * proves.
 * NOT CLAIMED: which physical screen edge the 32..41 band is (loc_2104 declined the same
 * question and it was not settled here), what the object at these coordinates is called, and
 * why the kind field selects the phase write. ram.js grounds the kind field only as the flag
 * stampReleasedBarrelKind writes alongside a distinct sprite code and attribute (46/46 live
 * agreement under MAME); which of the two kinds is which named object it deliberately does not
 * say, and neither does this.
 *
 * THE RETURN IS A PROTOCOL, not a value. On the retirement arm the ROM takes the caller's
 * return address off the stack itself and jumps into the shared object-sprite tail at ROM
 * 0x21BA, so control never comes back and the caller's remaining code must not run. All three
 * callers already obey that by guarding the call. `false` means "retired, control has left";
 * `true` means "returned normally, carry on".
 * That makes this address a CALLER-SKIP for the go-live seam: measured over 4000 cycle-free
 * attract frames, the oracle nets +4 guest-stack bytes on the `false` path against +2 on the
 * `true` path. While the tail is still frozen the rewrite performs that stack move itself, so the
 * seam's "did the body leave SP alone?" guard declines first and a table entry changes nothing —
 * measured, byte-identical either way. It becomes load-bearing when the tail is dissolved.
 *
 * The record base arrives in the index register and is deliberately NOT a parameter: the tail
 * is still frozen and reads the record straight off that register, so a caller passing a
 * different base would be obeyed by the writes here and ignored one hand-off later. It becomes
 * an honest parameter once ROM 0x21BA is decompiled.
 *
 * Reads: the record's OBJ_Y (+5), OBJ_X (+3) and kind (+0x15); the one-shot latch 0x6348.
 * Writes: the record's OBJ_ACTIVE (+0) and OBJ_X (+3); the phase byte 0x62B9 (kind arm only);
 * SND_TRIGGER+2; the one-shot latch 0x6348 (first firing only).
 *
 * Memory-equivalent to the frozen oracle — equivalence-24b4.test.js.
 * GATE:     ATTRACT plus CRAFTED. Every one of the 1154 real dispatches in a 1200-frame attract
 *           run is replayed inline (no sampling), oracle against rewrite on independently
 *           rehosted machines, comparing the FULL state dump including STACK_SCRATCH plus pc,
 *           SP and the returned protocol value. Those 1154 land on three of the five arms
 *           (1130 above the bottom, 23 past the band's high end, 1 retirement) across the five
 *           OBJ_ARRAY_67 record bases this run reaches. Replaying all of them is load-bearing
 *           rather than tidy: the band's high edge and the retirement arm get exactly ONE natural
 *           dispatch each out of 1154, so a sampled gate would have tested neither, and two of
 *           the twins below are caught only by those two dispatches. Attract never produces the
 *           low end of the band, never reaches either side of the bottom threshold exactly, never
 *           retires a zero-kind record and never re-enters with the one-shot already set, so five
 *           further arms are CRAFTED on real captures (one poke each, everything else left alone)
 *           and each craft is proved non-vacuous by showing it moves the ORACLE's own result. A
 *           retirement replay is not one routine's worth of work: the tail re-enters this address
 *           for the rest of the object walk, and the rewrite is installed in the replaying
 *           machine's registry, so the whole remaining walk runs against the oracle doing the
 *           same. Finally the rewrite drives a whole 1200-frame cycle-free attract run live (1183
 *           dispatches) against the all-oracle baseline. NOT covered: credited play and boards
 *           2-4 — the walk this belongs to runs only on 25m. Teeth: nine broken twins, five of
 *           which escape every natural capture and are caught only by a crafted arm (both halves
 *           asserted for each), four caught naturally — details in the test header.
 * LIVE-OUT: the protocol value, and nothing else. DERIVED: exactly three sites call this address
 *           (ROM 0x1FF6, 0x2053 and 0x2101 — the whole translated tree names it nowhere else),
 *           and all three reload the accumulator from the record's own OBJ_X or +0x10 as their
 *           very next act, so nothing the return arms leave in a register or flag is read back.
 *           On the retirement arm the question does not arise: the rewrite performs the oracle's
 *           own stack move and enters the same frozen tail, whose first act is to bank the
 *           register set and overwrite the accumulator before reading it. MEASURED: across all
 *           1154 natural and 5770 crafted replays the FULL dump, pc, SP and the returned value
 *           are identical to the oracle's, and the live run is byte-identical for all 1201
 *           sampled frames. pc and SP hold here rather than being excluded on principle — the
 *           rewrite keeps every stack move the oracle makes, and the gate drives it through the
 *           machine's own call-bracket seam — and pc is what catches a leaked return bracket,
 *           which RAM, SP and the returned value all miss (twin 9).
 * NAMES:    OBJ_ACTIVE (+0), OBJ_X (+3), OBJ_Y (+5) and SND_TRIGGER (0x6080, whose +2 is the
 *           latch asserted here) from ram.js. EVENT_REQ_313C is named above only to say what
 *           animateFixedHazardAndReleaseFire's second arm eventually raises; it is not touched here. Three of the things
 *           this routine touches have no ram.js name and are kept as file-local consts with
 *           their reasons: the record's kind field (+0x15), the phase byte (0x62B9) and the
 *           one-shot latch (0x6348) — the last two are multiplexed across readers with
 *           different roles, which is why ram.js leaves them unnamed and three sibling files
 *           already scope them locally. All three were checked against ram.js's exports rather
 *           than assumed absent.
 */

import { OBJ_ACTIVE, OBJ_X, OBJ_Y, SND_TRIGGER } from "./ram.js";

/**
 * Object-record kind flag (+0x15) — 0 for the default object, 1 for the alternate kind
 * stampReleasedBarrelKind writes alongside a different sprite code and attribute. Scoped to this
 * file rather than promoted to a shared OBJ_* name because offset 0x15 carries an unrelated role
 * on other arrays (loc_3409 down-counts it as a frame timer), exactly the trap ram.js flags for
 * the other multi-role record offsets.
 */
const OBJ_KIND = 0x15;

/** A Y of this or more counts as having reached the bottom — larger Y is lower on this screen. */
const BOTTOM_ROW = 232;
/** The column band, inclusive of the low end and exclusive of the high one. */
const BAND_LO = 32;
const BAND_HI = 42;

/** Three-frame assert on the impact sound (ls259.6h bit 2). */
const IMPACT_SOUND = SND_TRIGGER + 2;
const SOUND_FRAMES = 3;

/**
 * The phase byte animateFixedHazardAndReleaseFire dispatches on. No ram.js name: four unrelated routines write it and
 * animateFixedHazardAndReleaseFire is its only reader, so sibling files scope it locally too. Bit 0 SET lets animateFixedHazardAndReleaseFire's
 * body run at all, bit 1 selects its second arm — the one that runs a countdown and, on its
 * underflow, raises the object-insert request.
 */
const PHASE_BITS = 0x62b9;
const PHASE_CONTINUE = 1;
const PHASE_SECOND_ARM = 2;

/**
 * The one-shot mode latch; no ram.js name because it is multiplexed — loc_22cb reads it as the
 * object-velocity mode and startBarrelDescentAtLadder as a spawn gate. Both take CLEAR as the simple early-game
 * behaviour, so setting it here is a one-way switch into the graded behaviour.
 */
const MODE_LATCH = 0x6348;

/**
 * @param {object} m  the machine; the record base is read from its index register.
 * @returns {boolean} true when control returned to the caller normally; false when the object
 *   was retired and control was handed to the shared object-sprite tail, so the caller's
 *   remaining code must not run.
 */
export function loc_24b4(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  if (mem8[record + OBJ_Y] < BOTTOM_ROW) return true;

  const column = mem8[record + OBJ_X];
  if (column >= BAND_HI) return true;
  if (column < BAND_LO) return true;

  // Only the alternate kind arms the phase byte, and it does so before the record is torn down.
  if (mem8[record + OBJ_KIND] !== 0) mem8[PHASE_BITS] = PHASE_CONTINUE | PHASE_SECOND_ARM;

  // Retire the slot and blank the column it died in, then sound the impact.
  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  mem8[IMPACT_SOUND] = SOUND_FRAMES;

  // The caller's return address comes off the stack: control is not going back there. The word
  // is handed to the tail rather than thrown away — the tail banks the register set on entry, so
  // it lands in the alternate bank. It is preserved because the oracle preserves it, not because
  // a reader for it was found.
  m.regs.hl = m.pop16();

  // The one-shot: armed on the first retirement and left alone on every later one.
  if (mem8[MODE_LATCH] === 0) mem8[MODE_LATCH] = 1;

  // The shared object-sprite tail publishes the record just written and carries the walk on.
  m.call(0x21ba);
  return false;
}
