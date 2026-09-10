#!/usr/bin/env python3
"""Clean-room gate for a Computer Archeology contribution (ca-lines.md glosses, Code.md, RAMUse.md).

The CA listing must read as a disassembly of the ORIGINAL game's ROM, with NONE of our JavaScript
port's internals in it (docs/contributing-disassembly.md). The generator is already clean-room by
construction (it never opens translated/ or idiomatic/*.js except names.js), but the per-instruction
GLOSSES in ca-lines.md are hand/agent-authored, so port language can leak in through them. This gate
greps the authored/emitted text for that language and FAILS CLOSED on any hit.

Usage:  ca_cruft_gate.py <file> [<file> ...]      -> exit 0 iff clean; nonzero + offender list otherwise
        ca_cruft_gate.py --selftest                -> null-mutant proof: every pattern must catch injected cruft

Each pattern targets language that would NEVER appear in a plain game-fact gloss but DOES trace to our RE
(so a "no fabrication" check misses it). Deliberately NOT forbidden: "poke"/"cycle"/"cell" etc. -- those are
legitimate game-fact words (frogger's own glosses use "poke it into the cell").
"""
import re
import sys

# (label, compiled regex). Case-insensitive unless the token is genuinely case-bearing.
PATTERNS = [
    ("port API (m.call/m.ret/m.step/m.push/m.regs/...)", re.compile(r"\bm\.(call|ret|rti|step|push\d*|pull\d*|regs|read\d*|write\d*|mem\d*)\b", re.I)),
    ("stack/seam plumbing", re.compile(r"\b(withOmittedRet|push16|pull16|nmiReturnPC|fireNmi|fireIrq|STACK_SCRATCH|seamPlaceable)\b", re.I)),
    ("evidence tag [seen]/[code]/[guess]", re.compile(r"\[(seen|code|guess)(?:,[^\]]*)?\]", re.I)),
    ("methodology term", re.compile(r"\b(ground(?:ing|ed)|reachabilit\w*|entropy[- ]?pin\w*|null[- ]?mutant|memory[- ]?equivalent|byte[- ]?identical|drift[- ]?toleran\w*|convergen\w*)\b", re.I)),
    ("validation machinery", re.compile(r"\b(the\s+)?(frozen\s+)?oracle\b|\bequivalen\w*|\.test\.js\b", re.I)),
    # Case-SENSITIVE: the port's UPPERCASE footers, not a game-fact sentence like "latching the mode gate: when...".
    ("port footer (GATE:/LIVE-OUT)", re.compile(r"\bGATE:|\bLIVE-OUT\b")),
    ("MAME / emulator citation", re.compile(r"\bMAME\b|\bmame-src\b", re.I)),
    ("our-port layer names", re.compile(r"\b(idiomatic|translated)\b", re.I)),
    # Port-architecture jargon: how OUR engine is built (born-live skeleton, main-loop spine, clock-free
    # generator), never a fact about the original game. "airborne" is safe (word boundary on `spine`/`born-live`).
    ("port-architecture jargon (born-live / spine / clock-free)", re.compile(r"\bborn-?live\b|\bspine\b|\bclock-?free\b", re.I)),
    ("our-methodology section refs (§)", re.compile(r"§")),
    ("first-person / port voice", re.compile(r"\b(we|our|we've|we're|we'll|ours)\b", re.I)),
    ("wrong-game leftover (Donkey Kong / dk template)", re.compile(r"\bdonkey\b|\bkong\b|\bpauline\b|\bdk\s+maincpu\b", re.I)),
    ("T-state / cycle-timing modelling", re.compile(r"\bT-?states?\b|\bt-?cycles?\b|\bwait\s?states?\b(?!.*\bpaces?\b)", re.I)),
]

# Deliberately-clean sample lines the selftest confirms pass (guard against an over-broad pattern that
# would false-positive on legitimate game-fact glosses).
CLEAN_SAMPLES = [
    "0028\tread one byte from the ROM tile run",
    "0029\tpoke it into the cell the write pointer is sitting on",
    "0044\tthe per-row busy-wait count -- paces the writes on real video RAM, changes nothing visible",
    "1a55\tbring the whole board up, then the main loop",
    "06e1\tread the play sub-state gate and cycle to the next state",
    "5607\tRepaint the player-status column while latching the mode gate: when mode is set",
    "0a3b\tshot already airborne -- return, don't re-arm",
]


def scan(text):
    """Return a list of (lineno, label, matched) for every forbidden hit in `text`."""
    hits = []
    for i, line in enumerate(text.splitlines(), 1):
        for label, rx in PATTERNS:
            m = rx.search(line)
            if m:
                hits.append((i, label, m.group(0)))
    return hits


def selftest():
    """Null-mutant proof (Karl/prime discipline): inject a line carrying each forbidden token and confirm
    the gate REDs on it, AND confirm the clean samples stay green. A cruft gate that can't catch injected
    cruft is a check-that-cannot-fail."""
    injections = [
        "9999\tthis m.call(0x1234) is port plumbing",
        "9999\tuses withOmittedRet to seat the return",
        "9999\tthe role is [seen] confirmed",
        "9999\tgrounding this against the capture",
        "9999\tmatches the frozen oracle byte-for-byte",
        "9999\tverified against MAME",
        "9999\tthe idiomatic layer rewrites this",
        "9999\tjump to the born-live spine entry",
        "9999\tsee §4 of the runbook",
        "9999\twe poke this so our port advances",
        "9999\tDonkey Kong climbs the girders",
        "9999\tcharge the exact T-states here",
        "9999\tGATE: RAM-minus-stack",
        "9999\tLIVE-OUT: A and the flags",
    ]
    ok = True
    for line in injections:
        if not scan(line):
            print(f"SELFTEST FAIL: gate did NOT catch injected cruft: {line!r}")
            ok = False
    for line in CLEAN_SAMPLES:
        h = scan(line)
        if h:
            print(f"SELFTEST FAIL: gate false-positived a CLEAN gloss: {line!r} -> {h}")
            ok = False
    if ok:
        print(f"ca_cruft_gate selftest: OK ({len(injections)} injected-cruft lines all caught, {len(CLEAN_SAMPLES)} clean lines all pass)")
        return 0
    return 1


def main(argv):
    if argv and argv[0] == "--selftest":
        return selftest()
    if not argv:
        print("usage: ca_cruft_gate.py <file> [...] | --selftest", file=sys.stderr)
        return 2
    total = 0
    for path in argv:
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError as e:
            print(f"ca_cruft_gate: cannot read {path}: {e}", file=sys.stderr)
            return 2
        hits = scan(text)
        for lineno, label, matched in hits:
            print(f"{path}:{lineno}: PORT-CRUFT [{label}] -> {matched!r}")
        total += len(hits)
    if total:
        print(f"ca_cruft_gate: FAIL -- {total} port-cruft hit(s); the CA listing must read as the original ROM, not our port")
        return 1
    print("ca_cruft_gate: OK -- clean-room (no port cruft)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
