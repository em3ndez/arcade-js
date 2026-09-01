#!/usr/bin/env python3
"""Generic "Computer Archeology" contrib emitter: emit a game's data-driven CA
pages (RAMUse.md + Code.md) into games/<game>/contrib/computerarcheology/, in
the committed The-Pit format. Design notes, format spec and ship posture live in
tools/README-ca-contrib.md. Usage: gen_ca_contrib.py <game> [out_dir]."""

import json
import os
import re
import sys
import textwrap

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from z80_decode import decode  # noqa: E402  (same Z80 decoder tools/trace.py uses)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ------------------------------------------------------------- column geometry
ADDR_W = 6           # "AAAA: "
BYTES_W = 16         # raw-byte field
MNEM_W = 8           # mnemonic field
OPER_W = 20          # operand field  (6+16+8+20 = 50 -> ';' lands at column 50)
ROLE_WRAP = 72       # role-block prose wrap width (content, before the "; ")

BRANCH = ("call", "jp", "jr", "djnz")
TAG_RE = re.compile(r"\[(?:code|seen|guess)(?:,\s*[a-z]+)*\]")


def strip_grounding(s):
    """Drop RE-provenance ("grounded"/"grounding" citations, the `translated` qualifier)
    while KEEPING the game facts tangled with it -- a grounding note is a trailing
    sentence, an em-dash aside, or an inline clause; strip the wrapper, keep "NOT a
    generic counter" / "frog X is 0x8044". The words are never a game fact in these ports."""
    if not s:
        return s
    s = re.sub(r"\s*\(\s*poke-?grounded\b[^)]*\)", "", s, flags=re.I)              # (POKE-grounded: ...) paren
    s = re.sub(r"\s*[-–—]{1,2}\s*(?:grounded|grounding)\b.*$", "", s, flags=re.I)  # em-dash aside -> EOL
    s = re.sub(r"\.\s+(?:grounded|grounding)\b.*$", ".", s, flags=re.I)            # trailing ". Grounded ..."
    s = re.sub(r"[;,]?\s*(?:grounded|grounding)\b[^);]*", "", s, flags=re.I)       # inline clause -> ) or ;
    s = re.sub(r"\btranslated\s+", "", s)
    s = re.sub(r"\(\s*\)", "", s)                                                  # tidy seams left behind
    s = re.sub(r"\(\s*;\s*", "(", s)
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s+([);.,])", r"\1", s)
    return s.strip()

# Per-game intro paragraph for the Code.md ```code block. Falls back to a line
# built from the manifest when a game is absent here.
GAME_DESC = {
    "timeplt": (
        "Time Pilot (Konami, 1982). A free-roaming aerial shooter: your fighter "
        "holds the centre of the screen and turns to face the way you steer, while "
        "the whole world scrolls and banks around it, and you gun down swarms of "
        "enemy craft and the boss mother-ship that anchors each wave. Clearing a "
        "wave carries you forward through five eras of flight, each faster and more "
        "crowded than the last; parachutists drifting down are worth extra points "
        "if you collect them. Run out of fighters to end the game."
    ),
}

# Reached spans that are actually anti-tamper obfuscation: a deliberately misaligned
# "wrong-glyph" derail entry whose bytes execute as harmless NOPs / stray-stack POPs.
# Decoding them as code yields off-convention DEFBs (undefined opcodes) that choke the
# deploy tool, so we render them as CA data blocks and move the routine name+role to the
# real entry. Tuple: (start, end, block-label, lead-comment, name_src) -- name_src is a
# names.js routine addr whose name+role is shown at END+1 (the real entry) instead of at
# start, or None. See scratchpad/CA-topher-459b-followup.md.
FORCE_DATA = {
    "timeplt": [
        (0x459b, 0x45b2, "misaligned anti-tamper entry",
         'reached only via the "wrong-glyph" derail ($1772) and the loop-back ($4660); the '
         "bytes run as harmless NOPs and stray-stack POPs. The real routine is at $45B3.",
         0x459b),
        (0x49fa, 0x4a0e, "misaligned anti-tamper entry",
         'reached only via the "wrong-glyph" derail ($19E6); the bytes run as harmless NOPs and '
         "stray-stack POPs. The real routine is at $4A0F.",
         None),
    ],
    "pooyan": [
        (0x5119, 0x511a, "checksum sentinel",
         "the expected-sum byte the checksum fold at $50FD reads and compares against ($510E CP (HL) "
         "with HL=$5119); it is data, not code, and the disassembler mis-decoded it as an undefined "
         "opcode. Real code resumes at $511B.",
         None),
        # Anti-tamper crash sites: checksum/derail DATA the linear decode ran as CODE.
        # Boundaries verified vs out/dk.asm + names.js. Where a mis-decode's last instruction
        # STRADDLES and buries the real routine that follows, the span ends at the real entry-1
        # and that entry is recovered as code via FORCE_CODE (below) -- never via the old `src`
        # name-relocation, which silently drops the label when end+1 has no dk.asm loc-label.
        # derails 3274 JP NZ,$0799 / 7A01 JP NZ,$07D0; reader 3266 LD HL,$0799
        (0x0799, 0x07cf, "checksummed attract table + integrity crash pad",
         "Checksummed attract-screen formation and attribute bytes; a failed start-up integrity check jumps here so the machine runs this data as code and derails.", None),
        (0x07d0, 0x0869, "integrity-trap derail pad + attract attribute rows",
         "A second integrity-trap landing pad followed by attract-screen attribute-source rows; a failed low-byte checksum jumps here to run the bytes as code and hang the machine.", None),
        (0x086a, 0x0898, "packed attract-layout tables",  # buries 0x0899 -> FORCE_CODE
         "Packed attract-screen layout tables read as data by the attract sequence; the attract sub-state dispatcher runs just past them.", None),
        # reader 094A LD HL,$0976; derail 095E JR NZ,$0976; real code 0x0986
        (0x0976, 0x0985, "signature-window pointer table",
         "Eight little-endian ROM addresses spaced 0x20 apart, naming the protected memory windows the start-up signature check walks; a signature mismatch jumps here and runs the table as code.", None),
        (0x1fe2, 0x1ffa, "round-digit glyph tile table",  # buries 0x1ffb (call from 0x1f0e) -> FORCE_CODE
         "Packed tile codes for the round-number digit glyphs; the glyph-stamping routine runs just past them.", None),
        (0x2028, 0x204b, "round-marker glyph tile blocks",
         "Packed tile codes and 3x3 pictorial round-marker glyph blocks used to draw the round number.", None),
        (0x205a, 0x2060, "round-marker glyph tiles (cont.)",
         "More packed 3x3 round-marker glyph tile codes.", None),
        # reader/derail 2951 CP (HL)/2952 JP NZ,$2B9A; real code 0x29a0
        (0x296f, 0x299f, "signature block tail + attribute reference copy",
         "The tail of a 32-byte anti-tamper signature block plus a reference copy of an attract attribute row, compared byte-for-byte at round start; a mismatch jumps to a tamper trap.", None),
        # reader 2F4E LD HL,$2F93 (table base); real code resumes 0x305f (call from 0x2f01)
        (0x2fcb, 0x305e, "value-ramp table (cont.)",
         "The continuation of the descending value-ramp table based at $2F93 (a row-pointer header at $2F93 followed by ramps), read as data by the routine at $2F46; a fall-through mis-decoded these bytes as code.", None),
        # real code dispatchAllEnemyActorStates 0x3377
        (0x333d, 0x3376, "enemy launch-seed + dive/hunter script tables",
         "Hunter-formation launch-seed records and the dive/hunter animation-script tables read as data to spawn and animate the enemies.", None),
        (0x3829, 0x3864, "actor animation-script tables",  # buries 0x3865 -> FORCE_CODE
         "Actor animation-script tables: each step is a sprite-tile pair and a hold count, cycling the shape tiles then looping. The actor state handler runs just past them.", None),
        # display-list streams; interpreter ends 0x43e0; real code 0x4a0b
        (0x43e1, 0x4a0a, "display-list layout streams",
         "Display-list layout streams -- skip, literal and reload opcodes with literal tile runs -- painted into the screen by the display-list interpreter.", None),
        (0x4c92, 0x50f0, "display-list layout streams (round variants)",
         "More display-list layout streams (latched round variants) painted by the display-list interpreter.", None),
        # derail 662A JP NZ,$5284
        (0x5284, 0x5292, "enemy-release script blob",
         "An enemy-release script blob: paced spawn steps ending in an 0xff terminator.", None),
        (0x52c3, 0x52f5, "spawn-cadence records",
         "Ten five-byte spawn-cadence records addressed by the pointer list just above; each is a short value run.", None),
        # derails 32AD/68DF JP $76D4; real code 0x76ea
        (0x76d4, 0x76e9, "enemy-descent anim script + blink tiles",
         "Enemy-descent animation-script records (0xff-terminated, with back-pointers) plus the two tile pairs the blink effect swaps between.", None),
        # reader 79FC LD HL,$7A0B; 7A0A RET ends real code
        (0x7a0b, 0x7a5b, "checksum word + attract message table",
         "A checksum guard word followed by the attract message table: little-endian ROM addresses of the on-screen strings and the string bytes themselves.", None),
        # Dispatch/pointer tables the recursive descent mis-decoded as CODE (review ac4234a6): tables of
        # little-endian handler pointers, valid opcodes so no DEFB, not jp-nz targets so not a crash-site
        # suspect -- found via the RST-$28 + pointer-run scans. Three straddle and BURY the real entry that
        # follows (recovered via FORCE_CODE below).
        (0x0083, 0x0091, "boot self-test checksum reference table",
         "A start-up self-test reference table walked as data; the boot entry runs just past it.", None),
        (0x0247, 0x0253, "command dispatch pointer table",
         "Little-endian ROM addresses of the command handlers, indexed by command id and read as data by the command dispatcher.", None),
        (0x08a8, 0x08b2, "attract sub-state jump-table tail",
         "The tail of the attract sub-state jump table -- little-endian handler pointers the inline-table decoder truncated -- read as data by the attract dispatcher.", None),
        (0x30ed, 0x30f0, "attach-state jump-table tail",
         "The tail of the attach-state jump table -- little-endian handler pointers the inline-table decoder truncated.", None),
        (0x339b, 0x33bc, "actor-state dispatch jump table",
         "Seventeen little-endian ROM addresses -- the per-state handlers of the enemy-actor state machine -- indexed by actor state and read as data.", None),
    ],
}

# Buried real entries: a mis-decoded table (FORCE_DATA above) ended with an instruction that STRADDLED the
# real routine entry after it, so the recursive descent never decoded that entry -- it has NO dk.asm line at
# all (a coverage hole the byte round-trip flags). FORCE_CODE re-decodes the routine straight from the ROM
# (the same z80_decode the tracer uses) at the buried address, emitting synthetic instruction lines under the
# routine's name label until the decode resyncs with dk.asm's stream. Each addr must be a names.js routine.
FORCE_CODE = {
    "pooyan": [
        0x0092,   # runSelfTestAndInitMachineState -- THE boot entry (reset jp $0092)
        0x0254,   # repaintScrollColumnsElseVerifySignature (command-table tail buried it)
        0x08b3,   # resetToAttractScreenStart (attract sub-state jump-table tail buried it)
        0x0899,   # dispatchAttractSubstate (attract-layout table buried it) -- ld hl,$0bb5
        0x1ffb,   # stampSelectedGlyphBlock (round-digit glyph table buried it) -- ld a,b; called from $1f0e
        0x3865,   # advanceActorStateOnTimerWithTamperCheck (anim-script table buried it) -- call $4006
    ],
}

# Crash-site audit allowlist: suspects the audit REVIEWED and confirmed are valid (dead) CODE, not data
# -- e.g. a byte-for-byte anti-tamper code CLONE reached only via a tamper `jp nz` on a bad ROM. These
# stay CODE (they emit no DEFB and are correct); listing an addr here suppresses the crash-site flag for
# it. FORCE_DATA is for the DATA ones. See docs/contributing-disassembly.md "Anti-tamper crash sites".
CRASH_SITE_OK = {
    "pooyan": [
        0x6DF9, 0x7071,                          # byte-for-byte anti-tamper code clones (dead on a good ROM)
        0x0BB5, 0x0BB9, 0x5328, 0x776B, 0x780E,  # dual-use real code that is also checksum-summed
        0x2B23, 0x3278, 0x67DF, 0x6AC5,          # real routines that double as signature/checksum blocks
        0x0018,                                  # code loop (ld (hl),a/djnz); the ld de,$0018 load the const 24
        0x020F,                                  # real code (jp/jr $020F targets); the ld hl,$020F loads a code addr
    ],
}


# --------------------------------------------------------------------- helpers
def camel(name):
    """UPPER_SNAKE_CASE -> camelCase (SOUND_QUEUE_COUNT -> soundQueueCount)."""
    parts = name.split("_")
    return parts[0].lower() + "".join(p[:1].upper() + p[1:].lower() for p in parts[1:])


def clean_desc(text, upper_name=None):
    """Reduce a raw JSDoc/inline comment to one clean prose sentence: strip the JSDoc
    frame, evidence tags anywhere, RE-provenance (strip_grounding), and a leading
    `NAME (0xADDR) —` self-preamble; never leak a `*/`/tag/preamble or cut mid-token."""
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"^/\*+!?", "", s)          # leading /** or /* (or /*!)
    s = re.sub(r"^\*+", "", s)             # leading * line-marker(s)
    s = re.sub(r"\*/\s*$", "", s)          # trailing */ (survives even after a tag)
    s = TAG_RE.sub("", s)                  # evidence tags anywhere
    s = re.sub(r"\s+", " ", s).strip()     # normalise inner whitespace
    s = strip_grounding(s)                 # drop RE-provenance method-language
    if upper_name:                         # drop `NAME (0xADDR) —` / `NAME —` self-preamble
        s = re.sub(r"^" + re.escape(upper_name) +
                   r"\s*(?:\(0x[0-9a-fA-F]+\))?\s*[—–:\-]+\s*", "", s)
    # A residual mid-prose `(0xADDR) — gloss` is the same address-annotation device
    # as the self-preamble; render it as prose (`(0xADDR): gloss`) so no `(hex) —`
    # survives to read as a leaked preamble.
    s = re.sub(r"(\(0x[0-9a-fA-F]+\))\s*[—–]\s+", r"\1: ", s)
    return s.strip()


def strip_marker(st):
    """Strip one comment line's leading frame (`/**`/`/*`/`*`/`//`/`── ` rule) and
    any trailing `*/`, leaving just its prose so sibling lines can be joined."""
    st = st.strip()
    st = re.sub(r"^/\*+!?", "", st)             # /** or /* or /*!
    st = re.sub(r"\*/\s*$", "", st)             # trailing */
    st = re.sub(r"^\*+", "", st)                # JSDoc line marker *
    st = re.sub(r"^//+", "", st)                # // line comment
    st = re.sub(r"^\s*[─–—\-]+\s*", "", st)     # `── ` group-header rule
    return st.strip()


# Abbreviations whose trailing period is NOT a sentence end (checked case-folded).
_ABBREV = ("e.g.", "i.e.", "etc.", "vs.", "cf.", "al.", "fig.", "no.",
           "approx.", "ca.", "resp.", "incl.", "eq.", "eqn.", "viz.", "sp.")


def first_sentence(s, min_len=16):
    """The first COMPLETE sentence of `s` -- never cut mid-word/clause. A boundary is a
    `.`/`!`/`?` that ends `s` or is followed by whitespace (so `8.8`/hex are not) and is
    not a whole-token abbreviation; a very short leading label extends to the next
    boundary; no boundary -> the whole phrase."""
    if not s:
        return ""
    s = s.strip()
    n = len(s)
    for i, ch in enumerate(s):
        if ch not in ".!?":
            continue
        if i + 1 < n and not s[i + 1].isspace():
            continue                            # decimal / hex / section ref
        head = s[:i + 1]
        # a WHOLE-token abbreviation (`et al.`) is not a boundary; a word merely ending
        # in one (`ARRIVAL.`/`GOAL.` end in "al.") IS.
        hl = head.lower()
        if any(hl.endswith(a) and (len(hl) == len(a) or not hl[-len(a) - 1].isalpha())
               for a in _ABBREV):
            continue
        if i + 1 >= n or len(head) >= min_len:
            return head.strip()
    return s


_UPPER_TOKEN = re.compile(r"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+")   # a cell-constant name shape


def _split_sentences(s, min_len=16):
    """`s` as a list of its complete sentences (first_sentence applied repeatedly)."""
    out, rest = [], s.strip()
    while rest:
        head = first_sentence(rest, min_len)
        nxt = rest[len(head):].strip()
        if not head or nxt == rest:
            out.append(rest)
            break
        out.append(head)
        rest = nxt
    return out


def group_sentence(paragraph, own_upper, siblings):
    """Choose a shared `// --` group header's sentence for ONE cell under it.

    A group header's opening sentence often singles out ONE member by name
    (`HIGH_SCORE_HI is the MSB ...`); attributing that to a SIBLING states a
    falsehood. So skip any sentence naming a different cell constant, taking the
    first that names only this cell or none (else the plain first sentence)."""
    sents = _split_sentences(paragraph)
    for s in sents:
        if not any(t != own_upper and t in siblings for t in _UPPER_TOKEN.findall(s)):
            return s
    return sents[0] if sents else ""


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


# ------------------------------------------------------------------ map builds
def build_cells(names_path, lo, hi):
    """[(addr, camelName, description)] for every work-RAM `export const`.

    Per-cell description precedence: the inline `// ...` comment; else the JSDoc
    block directly above it; else the `// ──` group block the cell sits under (some
    cells -- e.g. the score bytes -- are only documented by their shared group
    header). Whichever the source, its FIRST PARAGRAPH's content lines are joined
    (unwrapping the hard-wrapped source) and reduced to the first COMPLETE sentence
    (`first_sentence`) -- so a row never ends mid-clause. Always cleaned: no
    evidence tag, no JSDoc frame, no `NAME (0xADDR) —` self-preamble.
    """
    text = open(names_path).read()
    lines = text.split("\n")
    siblings = set(re.findall(r"^export const ([A-Z_0-9]+) = 0x[0-9a-f]{4};", text, re.M))
    cells = []
    jsdoc_para = None      # first-paragraph lines of the JSDoc block above a cell
    group_para = None      # lines of the `// ──` group block the cell sits under
    in_jsdoc = False
    para_open = False      # still collecting the JSDoc block's FIRST paragraph
    export_re = re.compile(
        r"^export const ([A-Z_0-9]+) = (0x[0-9a-f]{4});(?:\s*//\s*(.*))?\s*$")
    group_head_re = re.compile(r"^//+\s*[─–—\-]+\s*\S")
    for line in lines:
        st = line.strip()
        # ---- open a JSDoc block (supersedes any pending group header) ----
        if not in_jsdoc and (st.startswith("/**") or
                             (st.startswith("/*") and not st.startswith("/*!"))):
            in_jsdoc, para_open, jsdoc_para, group_para = True, True, [], None
        if in_jsdoc:
            if para_open:
                content = strip_marker(st)
                if content:
                    jsdoc_para.append(content)
                elif jsdoc_para:
                    para_open = False        # first blank line ends the summary paragraph
            if "*/" in st:                   # closes single- AND multi-line blocks
                in_jsdoc = False
            continue
        # ---- `// ── <header>` group block + its continuation `//` lines ----
        if group_head_re.match(st):
            group_para = [strip_marker(st)]
            continue
        if group_para is not None and st.startswith("//"):
            c = strip_marker(st)
            if c:
                group_para.append(c)
            continue
        m = export_re.match(line)
        if not m:
            continue
        name, addr_s, inline = m.group(1), m.group(2), m.group(3)
        addr = int(addr_s, 16)
        if not (lo <= addr <= hi):
            jsdoc_para = None
            continue
        from_group = False
        if inline:
            raw = inline
        elif jsdoc_para:
            raw = " ".join(jsdoc_para)
        elif group_para:
            raw, from_group = " ".join(group_para), True
        else:
            raw = ""
        cleaned = clean_desc(raw, name)
        desc = (group_sentence(cleaned, name, siblings) if from_group
                else first_sentence(cleaned)).replace("|", r"\|")
        cells.append((addr, camel(name), desc))
        jsdoc_para = None
    cells.sort(key=lambda t: t[0])
    return cells


def build_routines(names_path):
    """addr -> (name, role, cert) for every ROUTINES entry.

    Widened vs gen_semantic_disasm.build_role_map to also catch the multi-line
    `0xADDR: {\\n name:..\\n role:..\\n cert:.. }` form and entries with a
    trailing `why:` field (single- or double-quoted)."""
    text = open(names_path).read()
    block = text[text.index("export const ROUTINES = {"):]
    entry = re.compile(
        r'0x([0-9a-f]{4}):\s*\{\s*name:\s*"([^"]*)"\s*,\s*'
        r'(?:entry:\s*"([^"]*)"\s*,\s*)?'  # optional secondary entry-point label
        r'role:\s*"((?:[^"\\]|\\.)*)"\s*,\s*cert:\s*"([^"]*)"',
        re.S,
    )
    m = {}
    for a, n, e, r, c in entry.findall(block):
        # label at this address = the override's `entry` secondary-entry name when present
        # (mirrors the loader's `meta.entry ?? meta.name`; keeps each address's label unique)
        m[int(a, 16)] = (e or n, unescape(r), c)
    # sanity: every `0xADDR: {` opener must have been captured.
    openers = re.findall(r"^  0x[0-9a-f]{4}: \{", block, re.M)
    assert len(openers) == len(m), \
        f"ROUTINES parse gap: {len(openers)} openers but {len(m)} parsed"
    return m


def clean_role(text):
    """A ROUTINES role cleaned for the clean-room CA header (drop ★, tags, §, MAME/LIVE-OUT;
    loc_XXXX -> $XXXX so no raw disassembler label leaks into the prose)."""
    t = text.replace("★", "")
    t = TAG_RE.sub("", t)
    t = re.sub(r"\bgrounded in MAME\b\s*(?:as|by|in|:)?\s*", "", t, flags=re.I)
    t = re.sub(r"§\S*", "", t)
    t = re.sub(r"[;,]?\s*\blive-?out\b.*", "", t, flags=re.I)
    t = re.sub(r"\bloc_([0-9a-f]{4})\b", lambda mm: "$" + mm.group(1).upper(), t)
    t = re.sub(r"\s+", " ", t).strip()     # single-line before grounding strip's end-anchors
    return strip_grounding(t)


def build_notes(gdir):
    """addr -> per-instruction clean-room gloss from <game>/ca-lines.md (`ADDR<TAB>text`
    per line), else {}. See docs/contributing-disassembly.md."""
    path = os.path.join(gdir, "ca-lines.md")
    notes = {}
    if os.path.exists(path):
        for ln in open(path).read().split("\n"):
            a, tab, txt = ln.partition("\t")
            if tab and re.fullmatch(r"[0-9a-fA-F]{4}", a.strip()) and txt.strip():
                notes[int(a.strip(), 16)] = txt.strip()
    return notes


def work_ram_region(game):
    """(lo, hi) of the work-RAM region from boards/<game>/hardware.json -- the board's own
    truth. Its region name varies: dkong/thepit `work`, frogger `ram`; prefer `work`, fall
    back to `ram`, fail loud if neither."""
    hw_path = os.path.join(REPO, "boards", game, "hardware.json")
    regions = json.load(open(hw_path)).get("stateRegions", [])
    work = (next((r for r in regions if r.get("name") == "work"), None)
            or next((r for r in regions if r.get("name") == "ram"), None))
    assert work, f"no 'work'/'ram' stateRegion in {hw_path}"
    return work["base"], work["base"] + work["size"] - 1


def parse_manifest(gdir):
    """title / manufacturer / year / cpu / maincpu ROM parts / ROM size."""
    text = open(os.path.join(gdir, "manifest.js")).read()

    def field(k, default=None):
        m = re.search(k + r':\s*"([^"]+)"', text)
        return m.group(1) if m else default

    meta = {
        "title": field("title", "Unknown"),
        "manufacturer": field("manufacturer", ""),
        "cpu": (field("cpu", "z80")).upper(),
    }
    ym = re.search(r"year:\s*(\d+)", text)
    meta["year"] = ym.group(1) if ym else ""
    mc = re.search(r"maincpu:\s*\{(.*?)\}", text, re.S)
    parts, size = [], 0x10000
    if mc:
        pm = re.search(r"parts:\s*\[([^\]]*)\]", mc.group(1))
        if pm:
            parts = re.findall(r'"([^"]+)"', pm.group(1))
        sm = re.search(r"size:\s*(0x[0-9a-fA-F]+|\d+)", mc.group(1))
        if sm:
            size = int(sm.group(1), 0)
    meta["rom_parts"] = parts
    meta["rom_size"] = size
    return meta


# ------------------------------------------------------------- RAMUse.md build
def gen_ramuse(meta, cells, wr_lo, wr_hi):
    lo, hi = wr_lo, wr_hi   # the work-RAM REGION span, not the last named cell
    out = []
    game_img = meta["_game"] + ".jpg"
    out.append(f"![{meta['title']}]({game_img})")
    out.append("")
    out.append("# RAM Usage")
    out.append("")
    out.append(f"Work RAM lives at `0x{lo:04X}`–`0x{hi:04X}`. Each name below describes "
               "the cell by its role in")
    out.append("the running game; the hex address is the stable identity. Cells that share a byte, or")
    out.append("whose role is only partly pinned, carry a terse caveat.")
    out.append("")
    out.append(">>> memory")
    out.append("")
    out.append("| Address | Name | Description |")
    out.append("| --- | --- | --- |")
    for addr, name, desc in cells:
        out.append(f"| {addr:04x} | {name} | {desc} |")
    return "\n".join(out) + "\n"


# --------------------------------------------------------------- Code.md build
def fmt_operand(operand):
    """Uppercase registers/conditions; 0x.. -> $..  (uppercase hex)."""
    op = re.sub(r"0x([0-9a-fA-F]+)", lambda m: "$" + m.group(1).upper(), operand)
    return op.upper()


def token_for(mnem, operand, routines, labels, wr_lo, wr_hi, rom_hi):
    """The trailing CA cross-reference token, or None."""
    if mnem in BRANCH:
        hits = re.findall(r"0x([0-9a-f]+)", operand)  # target is the last address
        if not hits:
            return None
        tgt = int(hits[-1], 16)
        # Only emit a cross-ref when the target actually gets a label line. A name in
        # `routines` (names.js) is NOT enough -- a derail/overlap can target the interior
        # of a routine that has no label at that exact address; emitting {code.NAME} there
        # dangles. `labels` is the set of addresses that DO get a label (loc lines +
        # FORCE_CODE entries, minus FORCE_DATA interiors). Otherwise render the raw $XXXX.
        if tgt in labels:
            rn = routines.get(tgt)
            if rn and not rn[0].startswith("loc_"):
                return "{code.%s}" % rn[0]
            return "{code.loc_%04x}" % tgt
        return None
    m = re.search(r"\(0x([0-9a-f]{4})\)", operand)  # only absolute (..) accesses
    if not m:
        return None
    tgt = int(m.group(1), 16)
    if wr_lo <= tgt <= wr_hi:
        off = tgt - wr_lo
        return "{hard.workRam}" if off == 0 else "{hard.workRam+%X}" % off
    if 0 <= tgt <= rom_hi:
        return "{hard.rom}" if tgt == 0 else "{hard.rom+%X}" % tgt
    return None


def xform_instr(raw, routines, labels, wr_lo, wr_hi, rom_hi, notes):
    code, _, comment = raw.partition(";")
    m = re.match(r"\s*([0-9a-f]+)\s+([0-9a-f ]+?)\s*$", comment)
    addr = m.group(1).upper()
    rawbytes = " ".join(b.upper() for b in m.group(2).split())
    code = code.strip()
    parts = code.split(None, 1)
    mnem = parts[0]
    operand = parts[1].strip() if len(parts) > 1 else ""
    op_out = fmt_operand(operand)
    tok = token_for(mnem, operand, routines, labels, wr_lo, wr_hi, rom_hi)
    gloss = notes.get(int(m.group(1), 16))
    line = f"{addr}: {rawbytes.ljust(BYTES_W)}{mnem.upper().ljust(MNEM_W)}{op_out.ljust(OPER_W)}"
    tail = " ".join(x for x in (tok, gloss) if x)
    if tail:
        line += "; " + tail
    return line


def _line_addr(line):
    """The address a dk.asm line sits at (label or instruction), or None."""
    m = re.match(r"^loc_([0-9a-f]+):\s*$", line)
    if m:
        return int(m.group(1), 16)
    if re.match(r"^    [a-z]", line):
        _, sep_, comment = line.partition(";")
        am = re.match(r"\s*([0-9a-f]+)\s", comment) if sep_ else None
        if am:
            return int(am.group(1), 16)
    return None


def _line_bytes(line):
    """The raw bytes of a dk.asm instruction line (from its `; addr b b ...`), or None."""
    _, sep_, comment = line.partition(";")
    if not sep_:
        return None
    bm = re.match(r"\s*[0-9a-f]+\s+([0-9a-f ]+?)\s*$", comment)
    return [int(b, 16) for b in bm.group(1).split()] if bm else None


def _line_start_addr(line):
    """The ROM address a dk.asm line STARTS at, for ANY body line type (instruction,
    loc label, UNREACHED-block header, defb data row, inline-jump-table header), or
    None for blanks. Used to advance past every line inside a FORCE_DATA span whose
    bytes are read from the ROM -- covering dk.asm coverage holes (a byte that fell
    between an instruction and the next block, so it has no line at all) and the
    UNREACHED/defb rows a span may enclose, neither of which _line_addr sees."""
    a = _line_addr(line)
    if a is not None:
        return a
    m = re.match(r"^; ==== UNREACHED 0x([0-9a-f]+)-", line)
    if m:
        return int(m.group(1), 16)
    m = re.match(r"^\s*;\s*([0-9a-f]+):\s+defb\b", line)
    if m:
        return int(m.group(1), 16)
    m = re.match(r"^; ---- inline jump table 0x([0-9a-f]+)-", line)
    if m:
        return int(m.group(1), 16)
    return None


def emit_data(body, start, end, data, label):
    """A thepit-style data block: `; ---- $A-$B: <label> ----` + 16-byte rows
    (region-relative, uppercase hex)."""
    body.append("; ---- $%04X-$%04X: %s ----" % (start, end, label))
    for k in range(0, len(data), 16):
        row = data[k:k + 16]
        body.append("%04X: %s" % (start + k, " ".join("%02X" % b for b in row)))


def gen_code(meta, raw_lines, routines, wr_lo, wr_hi, rom_hi, notes, rom=None):
    dk_loc_labels = set()
    for l in raw_lines:
        lm = re.match(r"^loc_([0-9a-f]+):\s*$", l)
        if lm:
            dk_loc_labels.add(int(lm.group(1), 16))
    labels = set(dk_loc_labels)

    # Anti-tamper obfuscation spans -> data blocks. `eff` is `routines` with the covered
    # bytes removed (they are data, not named routines) and each block's name+role moved
    # to the real entry (END+1); references into a block then render as a raw $addr.
    force = FORCE_DATA.get(meta["_game"], [])
    force_start = {f[0]: f for f in force}
    force_addrs = set()
    eff = dict(routines)
    for (s, e, _lbl, _cmt, src) in force:
        if src is not None and src in routines:
            eff[e + 1] = routines[src]
        for a in range(s, e + 1):
            eff.pop(a, None)
            force_addrs.add(a)
    labels = labels - force_addrs
    # Buried real entries to re-decode from the ROM (see FORCE_CODE). dk_line_addrs are the
    # addresses dk.asm has a line for -- where a synthetic re-decode resyncs with its stream.
    force_code = set(FORCE_CODE.get(meta["_game"], []))
    dk_line_addrs = {a for a in (_line_addr(l) for l in raw_lines) if a is not None}
    labels |= force_code   # FORCE_CODE entries DO get a label line -> refs to them resolve
    # Name-orphans: named routines dk.asm DECODED (has an instruction line) but never gave a
    # loc-label -- reached only via an indirect dispatch table (rst-28 / jp(hl) / command table),
    # so the static trace has no jump edge to them. The code is correct; only the name was missing.
    # Emit the name at the entry so the routine is identified and cross-refs to it resolve.
    name_orphans = {a for a, rn in eff.items()
                    if not rn[0].startswith("loc_") and a in dk_line_addrs
                    and a not in dk_loc_labels and a not in force_addrs}
    labels |= name_orphans

    # ---- top matter (mirrors thepit/Code.md) ----
    game = meta["_game"]
    head = []
    head.append(f"![{meta['title']}]({game}.jpg)")
    head.append("")
    head.append(f"# {meta['title']}")
    head.append("")
    head.append(f">>> cpu {meta['cpu']}")
    head.append("")
    binline = " + ".join("roms/" + p for p in meta["rom_parts"]) or "roms/maincpu"
    head.append(f">>> binary 0000:{binline}")
    head.append("")
    head.append(">>> memoryTable hard")
    head.append("")
    head.append("[Hardware Info](Hardware.md)")
    head.append("")
    head.append(">>> memoryTable ram")
    head.append("")
    head.append("[RAM Usage](RAMUse.md)")
    head.append("")
    head.append("```code")

    # ---- description block ----
    desc = GAME_DESC.get(game)
    if not desc:
        bits = [meta["title"]]
        if meta["manufacturer"] or meta["year"]:
            bits.append("(" + ", ".join(x for x in (meta["manufacturer"], meta["year"]) if x) + ")")
        desc = " ".join(bits) + "."
    dlines = ["; " + w for w in textwrap.wrap(desc, 76)]
    # reset-handoff + reachability note, derived from dk.asm
    reset_tgt = None
    for l in raw_lines:
        jm = re.match(r"^    jp 0x([0-9a-f]+)\s*;", l)
        if jm:
            reset_tgt = int(jm.group(1), 16)
            break
    arch = ""
    if reset_tgt is not None:
        rn = routines.get(reset_tgt)
        who = rn[0] if (rn and not rn[0].startswith("loc_")) else "loc_%04x" % reset_tgt
        arch = (f"Architecture: on reset ($0000) the CPU jumps to {who} "
                f"(${reset_tgt:04X}). ")
    arch += ('What follows is the code reached from the reset and interrupt entry points, '
             'shown as instructions; spans never reached appear as data (the "---- data '
             '----" blocks).')
    dlines.append(";")
    dlines += ["; " + w for w in textwrap.wrap(arch, 76)]

    # ---- body ----
    body = []

    def sep():
        if body and body[-1] != "":
            body.append("")

    # start at the first label; drop dk.asm's own header preamble.
    j = 0
    while j < len(raw_lines) and not raw_lines[j].startswith("loc_"):
        j += 1
    n = len(raw_lines)
    while j < n:
        line = raw_lines[j]
        if line.strip() == "":
            j += 1
            continue
        ah = _line_addr(line)
        if ah is not None and ah in force_start:
            s, e, lbl, cmt, _src = force_start[ah]
            need = e - s + 1
            if rom is not None:
                # Bytes from the ROM (ground truth): robust to dk.asm coverage holes
                # and to spans that enclose UNREACHED/defb rows. Advance past every
                # dk.asm line the span covers (start address <= e), so the outer loop
                # resumes exactly at the next region.
                assert e < len(rom), f"force-data 0x{s:04x}: end past ROM (0x{len(rom):04x})"
                data = list(rom[s:e + 1])
                while j < n:
                    sa = _line_start_addr(raw_lines[j])
                    if sa is not None and sa > e:
                        break
                    j += 1
            else:
                # Fallback (no ROM): scrape from dk.asm instruction lines. Stop the
                # instant we have the span's bytes, so we never consume a following
                # region's header (which has no parseable address) and orphan its data.
                data = []
                while j < n and len(data) < need:
                    a = _line_addr(raw_lines[j])
                    if a is not None and a > e:
                        break
                    bs = _line_bytes(raw_lines[j])
                    if bs:
                        data += bs
                    j += 1
            assert len(data) == need, f"force-data 0x{s:04x}: got {len(data)} != {need}"
            sep()
            for w in textwrap.wrap(cmt, ROLE_WRAP):
                body.append("; " + w)
            emit_data(body, s, e, data, lbl)
            # A buried real entry immediately after this data block: re-decode it from the ROM
            # (the mis-decode straddled it, so dk.asm has no line for it) and emit synthetic
            # instruction lines under its name label until the decode resyncs with dk.asm.
            if rom is not None and (e + 1) in force_code:
                pc = e + 1
                sep()
                rn = eff.get(pc)
                if rn and not rn[0].startswith("loc_"):
                    for w in textwrap.wrap(clean_role(rn[1]), ROLE_WRAP):
                        body.append("; " + w)
                    body.append(rn[0] + ":")
                else:
                    body.append("loc_%04x:" % pc)
                for _ in range(64):  # bounded; a real entry resyncs in 1-2 instrs
                    ins = decode(rom, pc)
                    synth = f"    {ins.text:<28} ; {pc:04x}  {ins.hexdump()}"
                    body.append(xform_instr(synth, eff, labels, wr_lo, wr_hi, rom_hi, notes))
                    pc += ins.length
                    if pc in dk_line_addrs:
                        break
                else:
                    raise AssertionError(f"force-code 0x{e+1:04x}: no resync within 64 instrs")
                # skip the misaligned dk.asm lines the synthetic decode covered
                while j < n:
                    sa = _line_start_addr(raw_lines[j])
                    if sa is not None and sa >= pc:
                        break
                    j += 1
            continue
        lm = re.match(r"^loc_([0-9a-f]+):\s*$", line)
        if lm:
            addr = int(lm.group(1), 16)
            sep()
            rn = eff.get(addr)
            if rn and not rn[0].startswith("loc_"):
                for w in textwrap.wrap(clean_role(rn[1]), ROLE_WRAP):
                    body.append("; " + w)
                body.append(rn[0] + ":")
            else:
                body.append("loc_%04x:" % addr)
            j += 1
            continue
        um = re.match(r"^; ==== UNREACHED 0x([0-9a-f]+)-0x([0-9a-f]+) \((\d+) bytes\) ====\s*$", line)
        if um:
            start, end, nby = int(um.group(1), 16), int(um.group(2), 16), int(um.group(3))
            j += 1
            data = []
            while j < n:
                dm = re.match(r"^\s*;\s*[0-9a-f]+:\s+defb\s+(.*)$", raw_lines[j])
                if not dm:
                    break
                for tok in dm.group(1).split(","):
                    hm = re.match(r"0x([0-9a-f]{1,2})", tok.strip())
                    if hm:
                        data.append(int(hm.group(1), 16))
                j += 1
            assert len(data) == nby, f"data region 0x{start:04x}: {len(data)} bytes != {nby}"
            sep()
            emit_data(body, start, end, data, "data")
            continue
        # An inline jump table: reachable word-pointer table. The Pit has no DW
        # construct (its tables are all UNREACHED), so -- to stay in its format --
        # render it as a data block, the pointer words as little-endian bytes.
        tm = re.match(r"^; ---- inline jump table 0x([0-9a-f]+)-0x([0-9a-f]+) ----\s*$", line)
        if tm:
            start, end = int(tm.group(1), 16), int(tm.group(2), 16)
            j += 1
            data = []
            while j < n:
                wm = re.match(r"^\s*dw\s+0x([0-9a-f]{1,4})\b", raw_lines[j])
                if not wm:
                    break
                w = int(wm.group(1), 16)
                data += [w & 0xFF, (w >> 8) & 0xFF]      # little-endian
                j += 1
            assert data, f"jump table 0x{start:04x}: header but no dw words"
            # The disassembler's stated end can be off by one -- pooyan's 0x2436 table ends its
            # header at the last WORD's address, not its final byte. The dw words are the byte-truth
            # (the byte round-trip verifies it), so span the block by them, not the header end.
            end = start + len(data) - 1
            sep()
            emit_data(body, start, end, data, "jump table")
            # The disassembler may ALSO have decoded the table's final byte(s) as code (an
            # overlap: e.g. `loc_2441: INC H` at 0x2441, already inside this block). Skip any
            # line the block already covers so no byte double-renders.
            while j < n:
                sa = _line_start_addr(raw_lines[j])
                if sa is not None and sa > end:
                    break
                j += 1
            continue
        if re.match(r"^    [a-z]", line):
            ia = _line_addr(line)
            if ia in name_orphans:   # a named dispatch target dk.asm never loc-labeled
                rn = eff[ia]
                sep()
                for w in textwrap.wrap(clean_role(rn[1]), ROLE_WRAP):
                    body.append("; " + w)
                body.append(rn[0] + ":")
            body.append(xform_instr(line, eff, labels, wr_lo, wr_hi, rom_hi, notes))
            j += 1
            continue
        j += 1  # anything else (should not occur) is dropped

    out = head + dlines + ["", ""] + body + ["```"]
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------- driver
def main():
    if len(sys.argv) not in (2, 3):
        sys.exit("usage: gen_ca_contrib.py <game> [out_dir]")
    game = sys.argv[1]
    gdir = os.path.join(REPO, "games", game)
    names_path = os.path.join(gdir, "idiomatic/names.js")
    raw_path = os.path.join(gdir, "out/dk.asm")
    # Default output is the game's own contrib dir; an explicit out_dir lets a
    # caller emit elsewhere (e.g. a scratch dir) WITHOUT writing into a finished
    # game's committed contrib -- used for the generalization diff.
    out_dir = sys.argv[2] if len(sys.argv) == 3 else os.path.join(gdir, "contrib/computerarcheology")
    os.makedirs(out_dir, exist_ok=True)

    meta = parse_manifest(gdir)
    meta["_game"] = game
    rom_hi = meta["rom_size"] - 1

    # work-RAM region from the board layer (TP 0xA800-0xAFFF, The Pit 0x8000-0x87FF);
    # cells outside it (ROM tables, colour/video/sprite RAM) are not RAMUse rows.
    wr_lo, wr_hi = work_ram_region(game)
    all_cells = build_cells(names_path, 0x0000, 0xFFFF)
    cells = [c for c in all_cells if wr_lo <= c[0] <= wr_hi]

    routines = build_routines(names_path)
    raw_lines = open(raw_path).read().split("\n")

    # The ROM (ground truth) supplies FORCE_DATA span bytes -- robust to dk.asm
    # coverage holes and enclosed data rows. Local/BYO, never committed; absent it
    # the emitter falls back to scraping dk.asm (fine for spans with no holes).
    rom_path = os.path.join(gdir, "rom", "maincpu.bin")
    rom = open(rom_path, "rb").read() if os.path.exists(rom_path) else None

    ramuse = gen_ramuse(meta, cells, wr_lo, wr_hi)
    notes = build_notes(gdir)
    code = gen_code(meta, raw_lines, routines, wr_lo, wr_hi, rom_hi, notes, rom)

    with open(os.path.join(out_dir, "RAMUse.md"), "w") as fh:
        fh.write(ramuse)
    with open(os.path.join(out_dir, "Code.md"), "w") as fh:
        fh.write(code)

    named = sum(1 for a, (n, r, c) in routines.items() if not n.startswith("loc_"))
    print(f"game   : {game}  ({meta['title']}, {meta['cpu']})")
    print(f"out    : {out_dir}/RAMUse.md  ({len(cells)} work-RAM cells)")
    print(f"out    : {out_dir}/Code.md")
    print(f"workRAM: 0x{wr_lo:04X}-0x{wr_hi:04X}   ROM: 0x0000-0x{rom_hi:04X}")
    print(f"routines: {len(routines)} total, {named} English-named, {len(routines)-named} loc_")

    # Guardrail: a DEFB is the disassembler's undefined-opcode fallback -- off-convention for a
    # CA submission (it chokes the deploy tool). Fail loud so each is resolved before submitting.
    defbs = [ln.strip() for ln in code.split("\n") if re.search(r"\bDEFB\b", ln)]
    if defbs:
        print("\n*** Code.md still contains DEFB (undefined-opcode fallback), off-convention:",
              file=sys.stderr)
        for ln in defbs:
            print("      " + ln, file=sys.stderr)
        print("    Resolve each before submitting -- add its span to FORCE_DATA (anti-tamper / data "
              "misdecoded as code) or fix the disassembler. See scratchpad/CA-topher-459b-followup.md.",
              file=sys.stderr)
        sys.exit(1)

    # Crash-site audit (fail-closed). Anti-tamper derails jump CONDITIONALLY into DATA on a checksum
    # miss; the recursive-descent disassembler decodes that data as code. The DEFB check above only
    # catches UNDEFINED opcodes -- a derail span whose bytes decode as VALID opcodes slips through as
    # bogus code with no DEFB (the trap Karl caught on pooyan). Flag the high-confidence signature -- a
    # conditional-branch target that is ALSO loaded as a data pointer, still rendered as code -- and fail
    # until each is classified: FORCE_DATA the DATA ones, CRASH_SITE_OK the valid dead code-clones. This
    # is a NET, not the whole audit -- also do the manual sweep in docs/contributing-disassembly.md
    # "Anti-tamper crash sites" (script tables, text, checksum blocks the heuristic may not catch).
    cond_tgt, data_ptr = set(), set()
    for ln in raw_lines:
        m = re.search(r"\b(?:jp|jr)\s+n?z,0x([0-9a-f]+)", ln)
        if m:
            cond_tgt.add(int(m.group(1), 16))
        m = re.search(r"\bld\s+(?:hl|de|bc),0x([0-9a-f]+)", ln)
        if m:
            data_ptr.add(int(m.group(1), 16))
    code_addr = {int(m.group(1), 16) for m in
                 (re.match(r"^([0-9A-Fa-f]{4}): ", l) for l in code.split("\n")) if m}
    forced = {a for (s, e, *_rest) in FORCE_DATA.get(game, []) for a in range(s, e + 1)}
    suspects = sorted((cond_tgt & data_ptr & code_addr) - forced - set(CRASH_SITE_OK.get(game, [])))
    if suspects:
        print("\n*** Suspected anti-tamper CRASH SITES (a conditional-branch target ALSO read as a data "
              "pointer, still rendered as code) -- AUDIT each before shipping:", file=sys.stderr)
        for a in suspects:
            print(f"      0x{a:04x}", file=sys.stderr)
        print("    A checksum/derail DATA span -> add to FORCE_DATA; a valid dead code-clone -> add to "
              "CRASH_SITE_OK. Do NOT ship until each is resolved. See docs/contributing-disassembly.md.",
              file=sys.stderr)
        sys.exit(1)

    # Byte round-trip (fail-closed, when the ROM is present): every ROM byte must appear
    # exactly once in Code.md and match. This catches a dk.asm coverage HOLE (a byte with
    # no line at all -- how the $2FCB value-ramp table surfaced) and any FORCE_DATA span
    # that drops or duplicates a byte. It is the definitive completeness check for BYTES
    # (it cannot see data that merely decodes as plausible code -- that needs a MAME trace).
    if rom is not None:
        emitted = {}
        for ln in code.split("\n"):
            m = re.match(r"^([0-9A-Fa-f]{4}):\s+(.*)$", ln)
            if not m:
                continue
            byte_field = re.split(r"\s{2,}", m.group(2))[0].strip()
            toks = byte_field.split()
            if not toks or not all(re.fullmatch(r"[0-9A-Fa-f]{2}", t) for t in toks):
                continue
            base = int(m.group(1), 16)
            for k, t in enumerate(toks):
                emitted[base + k] = int(t, 16)
        mism = [a for a in range(len(rom)) if emitted.get(a) != rom[a]]
        if mism:
            print(f"\n*** Byte round-trip FAILED: {len(mism)} of {len(rom)} ROM bytes wrong/missing "
                  "in Code.md -- the listing does not reconstruct the ROM:", file=sys.stderr)
            for a in mism[:20]:
                g = emitted.get(a)
                print(f"      0x{a:04x}: Code.md {('%02x' % g) if g is not None else 'MISSING'}  "
                      f"ROM {rom[a]:02x}", file=sys.stderr)
            print("    A MISSING byte is usually a dk.asm coverage hole inside a mis-decoded data table "
                  "-> FORCE_DATA the table. See docs/contributing-disassembly.md.", file=sys.stderr)
            sys.exit(1)

    # Dangling cross-reference (fail-closed): every emitted {code.NAME} must have a matching
    # `NAME:` label line, or the CA toolchain link breaks. A derail/overlap can target the
    # interior of a named routine that has no label there -- token_for now renders those raw,
    # but this gate guarantees none slip through (e.g. a buried entry not recovered by FORCE_CODE).
    emitted = set()
    for ln in code.split("\n"):
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*$", ln) or re.match(r"^(loc_[0-9a-f]+):", ln)
        if m:
            emitted.add(m.group(1))
    dangling = {}
    for ln in code.split("\n"):
        for m in re.finditer(r"\{code\.([A-Za-z0-9_]+)\}", ln):
            if m.group(1) not in emitted:
                dangling.setdefault(m.group(1), ln.strip())
    if dangling:
        print(f"\n*** {len(dangling)} DANGLING {{code.X}} cross-reference(s) -- named target with no label "
              "line (CA link breaks):", file=sys.stderr)
        for name, ex in list(dangling.items())[:20]:
            print(f"      {{code.{name}}}  e.g. | {ex[:90]}", file=sys.stderr)
        print("    The target is a real routine buried by a mis-decode -> recover it with FORCE_CODE, or if "
              "it is a derail into a routine interior it should render raw. See docs/contributing-disassembly.md.",
              file=sys.stderr)
        sys.exit(1)

    # Straddle-bury gate (fail-closed): a FORCE_DATA span must not end just before a NAMED routine
    # whose entry then has no label -- that means the span's mis-decode straddled and buried the real
    # entry (its first instruction shipped as data), or orphaned it. The round-trip and dangling gates
    # are BLIND to this (bytes present as data; a call/jp to it renders raw, not dangling). Recover the
    # entry via FORCE_CODE, or (if it already has a correct dk.asm line) the name_orphan path labels it.
    # NOTE this deliberately does NOT flag routines the static trace left UNREACHED (rendered as data) --
    # indirect-dispatch-only handlers with no static edge are the recursive-descent norm the shipped
    # dkong/thepit contribs also accept (documented in docs/contributing-disassembly.md).
    buried = []
    for (s, e, *_r) in FORCE_DATA.get(game, []):
        rn = routines.get(e + 1)
        if rn and not rn[0].startswith("loc_") and rn[0] not in emitted:
            buried.append((s, e, e + 1, rn[0]))
    if buried:
        print("\n*** FORCE_DATA span(s) BURY/orphan a named routine at end+1 (no label line):",
              file=sys.stderr)
        for s, e, nx, name in buried:
            print(f"      span 0x{s:04x}-0x{e:04x} -> {name} @ 0x{nx:04x} unlabeled", file=sys.stderr)
        print("    Recover a byte-buried entry via FORCE_CODE. See docs/contributing-disassembly.md.",
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
