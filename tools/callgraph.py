#!/usr/bin/env python3
# callgraph.py -- static call-graph extractor for the §3 translation pass.
#
# WHY: the boot-gap crawl (translate until m.call throws, translate the gap, repeat) discovers
# routines ONE AT A TIME -- reliable but strictly sequential, and slow. This recovers ~the whole
# routine set in ONE static pass so a game's entire frontier is known before any lift. It does the
# four things plain recursive descent does not (see docs/runbook.md §3):
#   1. recover rst-0x28 INLINE jump-table targets (the computed jumps that hide routine entries),
#   2. flag call/jp targets that land mid-routine as SECOND ENTRY points,
#   3. derive data-vs-code from REACHABILITY (never a hand-maintained exclusion list),
#   4. report the irreducible residue (jp (hl) with no static table) explicitly.
#
# rst 0x28 (0xef): the handler at 0x0028 does `pop hl` (hl = the inline table base = the byte AFTER
#   the rst), indexes by A*2, and jp (hl)'s. So the words at P+1 ARE code entry points, and P+1.. is
#   DATA (do not decode it as instructions). The caller usually `push`es a continuation that sits
#   right after the table -> that pushed value is the strongest table-length bound.
# rst 0x20/0x10/... : an ordinary call to a page-zero helper (rst 0x20 is a byte-table LOOKUP that
#   returns a value in A -- its table is DATA, not code entries). Treated as a call; flow continues.
#
# ⚠ STATUS / KEY LESSON (validated on Pooyan 2026-08-20):
#   * The rst-0x28 table READER is correct: given a table base, `_recover_rst28` reads the right
#     entries (`--validate` = 2/2 exact vs the documented tables). Direct call/jp/jr descent is sound.
#   * PURE-STATIC DISCOVERY OVER-REACHES CATASTROPHICALLY: without a code/data oracle, recursive
#     descent wanders into graphics/text/table DATA (one over-read table or one data-as-code jump
#     cascades). On Pooyan this reports ~1693 heads vs the true ~459 -- the data-vs-code ambiguity is
#     NOT "a few slip through", it is a cascade. This is the irreducible hard part (item 4).
#   * THE FIX = gate discovery on the MAME executed-instruction trace (the coin+play trace §3 already
#     mandates as the code/data cross-check): decode/descend ONLY within MAME-proven-code addresses,
#     and confirm each rst-28 table entry was actually executed. That collapses the over-count to the
#     true frontier. TODO: add `--trace <mame_exec_trace>` to mask decoding + entry acceptance to
#     proven-code addresses. Until then this tool is a STRUCTURE prototype, not a standalone extractor.
#
# Usage:
#   python3 tools/callgraph.py --game pooyan            # full report (heads / frontier / residue)
#   python3 tools/callgraph.py --game pooyan --validate # + cross-check recovered rst-28 tables vs
#                                                         the translated DISPATCH_TABLE_ docs
#   python3 tools/callgraph.py --game pooyan --frontier # just the uncovered frontier addresses

import sys, os, glob, re, argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import z80_decode as z

ROM_LO = 0x0100   # plausible code lives at/above here (page zero is rst handlers + vectors)
ROM_HI = 0x8000   # maincpu ROM ceiling


def load_rom(game):
    p = f"games/{game}/rom/maincpu.bin"
    rom = open(p, "rb").read()
    return bytes(rom) + bytes(max(0, 0x10000 - len(rom)))


def covered_from_registry(game):
    reg = f"games/{game}/translated/_registry.generated.js"
    if not os.path.exists(reg):
        return set()
    txt = open(reg).read()
    return set(int(m, 16) for m in re.findall(r"loc_([0-9a-fA-F]{4})\b", txt))


def documented_tables(game):
    # DISPATCH_TABLE_X = "base (...): h1 h2 h3 ..." in the translated layer -> {base: [entries]}.
    tables = {}
    for f in glob.glob(f"games/{game}/translated/loc_*.js"):
        for line in open(f):
            # format: DISPATCH_TABLE_06F0 = "0x06f0 (desc): 072d 0899 0c4e ..."  (entries optional)
            m = re.search(r'DISPATCH_TABLE_\w+\s*=\s*"0x([0-9a-fA-F]{3,4})\b[^"]*?:\s*([0-9a-fA-F ]+)"', line)
            if m:
                base = int(m.group(1), 16)
                ents = [int(h, 16) for h in re.findall(r"\b([0-9a-fA-F]{4})\b", m.group(2)) if int(h, 16) < ROM_HI]
                tables[base] = ents
    return tables


class Graph:
    def __init__(self, mem):
        self.mem = mem
        self.decoded = {}          # addr -> Instr (every byte we decoded as an instruction start)
        self.entries = set()       # routine / second-entry heads
        self.rst28_tables = {}     # base -> [entry words]
        self.table_bytes = set()   # addresses that are inline-table DATA (never decode)
        self.unresolved = []       # (site_addr, reason) for computed jumps we could not resolve

    def run(self, seeds):
        work = list(seeds)
        self.entries.update(seeds)
        visited_flow = set()
        while work:
            start = work.pop()
            if start in visited_flow or not (0 <= start < ROM_HI):
                continue
            new_targets = self._walk(start, visited_flow)
            for t in new_targets:
                if t not in self.entries:
                    self.entries.add(t)
                if t not in visited_flow:
                    work.append(t)

    def _walk(self, start, visited_flow):
        # Linear-decode one flow run from `start`, collecting the new heads it branches/calls to.
        mem = self.mem
        a = start
        found = set()
        last_and = None   # most recent `and n` mask on A (index bound for a following rst 0x28)
        last_cp = None    # most recent `cp n`
        pending_push = None  # value of the most recent push of an immediate (rst-28 continuation)
        while 0 <= a < ROM_HI:
            if a in self.table_bytes:
                break
            if a in visited_flow:
                break
            visited_flow.add(a)
            ins = z.decode(mem, a)
            self.decoded[a] = ins
            k, t = ins.kind, ins.target
            txt = ins.text
            nxt = a + ins.length

            # track index bound + continuation push for a possible rst 0x28
            m_and = re.match(r"and 0x([0-9a-fA-F]+)$", txt)
            if m_and:
                last_and = int(m_and.group(1), 16)
            m_cp = re.match(r"cp 0x([0-9a-fA-F]+)$", txt)
            if m_cp:
                last_cp = int(m_cp.group(1), 16)
            m_ldi = re.match(r"ld (?:hl|de|bc),0x([0-9a-fA-F]+)$", txt)
            if m_ldi:
                pending_push = int(m_ldi.group(1), 16)
            elif txt.startswith("push "):
                # a push of the just-loaded immediate -> candidate table end
                pass  # pending_push already holds the ld value; keep it
            elif not txt.startswith(("ld hl", "ld de", "ld bc")):
                pass

            if k in (z.CALL, z.CALL_COND) and t is not None:
                found.add(t)
                a = nxt
                continue
            if k == z.RST:
                if t == 0x28:
                    base = nxt  # inline table begins at the byte after the rst
                    ents = self._recover_rst28(base, last_and, last_cp, pending_push)
                    self.rst28_tables[base] = ents
                    for e in ents:
                        found.add(e)
                    found.add(0x28)
                    # rst 0x28 does NOT fall through into the table -> stop this run
                    break
                else:
                    found.add(t)     # ordinary page-zero helper (rst 0x20 etc.)
                    a = nxt
                    continue
            if k == z.RET or k == z.HALT:
                break
            if k == z.JUMP and t is not None:
                found.add(t)
                break
            if k == z.JUMP_COND and t is not None:
                found.add(t)
                a = nxt
                continue
            if k == z.RET_COND:
                a = nxt
                continue
            if k == z.JUMP_INDIRECT:
                self.unresolved.append((a, txt))
                break
            a = nxt
        return found

    def _recover_rst28(self, base, last_and, last_cp, pending_push):
        mem = self.mem
        # length bounds, tightest first:
        bounds = []
        if pending_push is not None and pending_push > base:
            bounds.append((pending_push - base) // 2)      # continuation sits right after the table
        if last_and is not None:
            bounds.append(last_and + 1)                    # index masked to 0..mask
        if last_cp is not None:
            bounds.append(last_cp)                          # index checked < N
        cap = min(bounds) if bounds else 64
        ents = []
        for i in range(cap):
            wa = base + 2 * i
            w = mem[wa] | (mem[wa + 1] << 8)
            if not (ROM_LO <= w < ROM_HI):
                break                                      # trailing non-code word -> table ended
            ents.append(w)
        for i in range(len(ents)):
            self.table_bytes.update({base + 2 * i, base + 2 * i + 1})
        return ents

    def routine_ranges(self):
        # A routine head owns bytes from its addr up to the next head or first terminator we decoded.
        heads = sorted(self.entries)
        ranges = {}
        for h in heads:
            a = h
            end = h
            seen = set()
            while 0 <= a < ROM_HI and a in self.decoded and a not in seen:
                seen.add(a)
                ins = self.decoded[a]
                end = a + ins.length
                if ins.kind in (z.RET, z.HALT, z.JUMP, z.JUMP_INDIRECT):
                    break
                if ins.kind == z.RST and ins.target == 0x28:
                    break
                a = a + ins.length
            ranges[h] = (h, end)
        return ranges

    def second_entries(self):
        # heads that fall strictly inside another head's [start,end)
        ranges = self.routine_ranges()
        heads = sorted(self.entries)
        inner = set()
        for h in heads:
            for (s, e) in ranges.values():
                if s < h < e:
                    inner.add(h)
                    break
        return inner


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", required=True)
    ap.add_argument("--validate", action="store_true")
    ap.add_argument("--frontier", action="store_true")
    ap.add_argument("--reset", default="0x0000")
    ap.add_argument("--nmi", default="0x0066")
    ap.add_argument("--cpu", default="z80", choices=["z80", "8080"],
                    help="instruction set (default z80; 8080 for Midway/Taito boards)")
    args = ap.parse_args()

    # Additive: the 8080 decoder exposes the same Instr/kind names, so swapping the module the
    # Graph walks over (z) is all it takes; z80 games are untouched. 8080 seeds are the reset
    # vector + the two RST interrupt handlers (mid-screen 0x08, vblank 0x10).
    global z
    seeds = {int(args.reset, 16), int(args.nmi, 16)}
    if args.cpu == "8080":
        import i8080_decode
        z = i8080_decode
        seeds = {0x0000, 0x0008, 0x0010}

    mem = load_rom(args.game)
    g = Graph(mem)
    g.run(seeds)

    covered = covered_from_registry(args.game)
    heads = set(a for a in g.entries if a >= ROM_LO)
    frontier = sorted(h for h in heads if h not in covered)

    if args.frontier:
        print(" ".join("0x%04x" % a for a in frontier))
        return

    inner = g.second_entries()

    print(f"game: {args.game}")
    print(f"routine heads (reachable): {len(heads)}")
    print(f"  covered in registry:     {len(heads & covered)}")
    print(f"  FRONTIER (uncovered):    {len(frontier)}")
    if frontier:
        print("   " + " ".join("0x%04x" % a for a in frontier))
    print(f"rst-0x28 dispatch tables recovered: {len(g.rst28_tables)}")
    print(f"second/interior entry points: {len(inner)}")
    if inner:
        print("   " + " ".join("0x%04x" % a for a in sorted(inner)))
    print(f"UNRESOLVED computed jumps (need MAME trace): {len(g.unresolved)}")
    for site, txt in g.unresolved[:40]:
        print(f"   0x%04x  {txt}" % site)

    if args.validate:
        doc = documented_tables(args.game)
        print(f"\n--- VALIDATE: recovered rst-0x28 tables vs {len(doc)} documented DISPATCH_TABLE_ ---")
        ok = miss = 0
        for base, ents in sorted(doc.items()):
            rec = g.rst28_tables.get(base)
            if rec is None:
                print(f"  0x%04x: documented but NOT recovered (%d entries)" % (base, len(ents)))
                miss += 1
                continue
            recset, docset = set(rec), set(ents)
            if recset == docset:
                ok += 1
            else:
                miss += 1
                extra = sorted(recset - docset)
                gone = sorted(docset - recset)
                print(f"  0x%04x: MISMATCH  +%s  -%s" % (base,
                      [hex(x) for x in extra], [hex(x) for x in gone]))
        print(f"  tables exact: {ok}/{len(doc)}  (mismatch/missing: {miss})")


if __name__ == "__main__":
    main()
