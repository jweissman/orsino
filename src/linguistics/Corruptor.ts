/// Corrupts words by applying a series of phonological transformations, simulating natural language evolution and variation.

// Phonology: Define the sound system of the language, including vowels, consonants, and phonotactic rules.
class Phonology {
  static vowels = 'aeiouyáéíóúàèìòùâêîôûäëïöüāēīōūȳạẹịọụōæë';
  static vowelClass = `[${Phonology.vowels}]`;
  static consonantClass = `[^${Phonology.vowels}]`; // only safe if you also gate with [a-z...]

  static isVowel = (c: string) => Phonology.vowels.includes(c.toLowerCase());
  static isConsonant = (c: string) => !Phonology.isVowel(c) && !(c === ' '); // treat space as neutral
}

class Sonority {
  // lower = “weaker/easier to delete”
  static score(ch: string): number {
    const c = ch.toLowerCase();
    const map: Record<string, number> = {
      'h': 0, 'y': 1, 'w': 1,
      'r': 2, 'l': 2,
      'n': 3, 'm': 3,
      's': 4,
      // protected digraph placeholders: treat as fairly “strong”
      'Þ': 5, 'Ġ': 5, 'Ҡ': 5, 'Š': 5, 'Č': 5, 'Ф': 5, 'Ð': 5, 'Ꚏ': 5, 'Ɋ': 5,
    };
    return map[c] ?? 6; // stops/plosives default “strong”
  }

  static pickDeletionIndex(run: string): number {
    let best = Math.floor(run.length / 2);
    let bestScore = 999;
    for (let i = 0; i < run.length; i++) {
      const sc = Sonority.score(run[i]);
      if (sc < bestScore) { bestScore = sc; best = i; }
    }
    return best;
  }
}



class DigraphGuard {
  static protect(s: string): string {
    return s
      .replace(/th/gi, 'Þ')
      .replace(/gh/gi, 'Ġ')
      .replace(/kh/gi, 'Ҡ')
      .replace(/sh/gi, 'Š')
      .replace(/ch/gi, 'Č')
      .replace(/ph/gi, 'Ф')
      .replace(/dh/gi, 'Ð')
      .replace(/tz/gi, 'Ꚏ')
      .replace(/qu/gi, 'Ɋ')
  }
  static unprotect(s: string): string {
    return s
      .replace(/Þ/g, 'th')
      .replace(/Ġ/g, 'gh')
      .replace(/Ҡ/g, 'kh')
      .replace(/Š/g, 'sh')
      .replace(/Č/g, 'ch')
      .replace(/Ф/g, 'ph')
      .replace(/Ð/g, 'dh')
      .replace(/Ꚏ/g, 'tz')
      .replace(/Ɋ/g, 'qu')
      ;
  }

  static placeholders = ['Þ', 'Ġ', 'Ҡ', 'Š', 'Č', 'Ф', 'Ð', 'Ꚏ', 'Ɋ'];
}

class MorphemeGuard {
  static commonStartsRaw = ['br', 'st', 'sp', 'sk', 'ph', 'th', 'dr', 'tr', 'gr', 'kr', 'kh', 'gh', 'sh', 'ch'];
  static commonStarts = MorphemeGuard.commonStartsRaw.map(x => DigraphGuard.protect(x).toLowerCase());

  static looksLikeSeam(protectedWord: string, index: number): boolean {
    const look = protectedWord.slice(index + 1, index + 4).toLowerCase();
    return this.commonStarts.some(st => look.startsWith(st));
  }
}

type RunMode = 'repair' | 'shrink';

class PhonoUtil {
  static getProtectedCoda(word: string): string {
    const ps = DigraphGuard.protect(word);
    const V = new RegExp(Phonology.vowelClass, 'iu');
    const chars = [...ps];

    // Find the last vowel position.
    let lastV = -1;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars[i] !== ' ' && V.test(chars[i])) { lastV = i; break; }
    }
    if (lastV < 0) { return ps; }

    // Coda = everything after the last vowel, ignoring spaces.
    const tail = chars.slice(lastV + 1).filter(ch => ch !== ' ').join('');
    return tail;
  }

  static isLegalFinal(word: string, profile: Profile): boolean {
    if (!profile.legalFinals) { return true; }
    const coda = PhonoUtil.getProtectedCoda(word);
    // legalFinals is intended to match the coda only (e.g. '', 'n', 'nd', 'st', 'gh', etc.)
    return profile.legalFinals.test(DigraphGuard.unprotect(coda));
  }
  static countVowels(s: string): number {
    const re = new RegExp(Phonology.vowelClass, 'giu');
    return (s.match(re) || []).length;
  }

  static hasVowel(s: string): boolean {
    return new RegExp(Phonology.vowelClass, 'iu').test(s);
  }

  static isLetter(c: string): boolean {
    // Keep it simple: treat anything not space as "letter-ish"
    // If you want stricter, expand with unicode ranges later.
    return c !== ' ';
  }

  static breakRuns(s: string, profile: Profile, mode: RunMode = 'repair'): string {
    const chars = [...DigraphGuard.protect(s)];
    const isC = (ch: string) => Phonology.isConsonant(ch) && ch !== ' ';
    const maxRun = (runStr: string) => {
      if (typeof profile.maxConsonantRunWithLiquids === 'number') {
        const r = runStr.toLowerCase();
        if (r.includes('r') || r.includes('l')) { return profile.maxConsonantRunWithLiquids; }
      }
      return profile.maxConsonantRun;
    };

    const findRun = () => {
      for (let i = 0; i < chars.length; i++) {
        if (!isC(chars[i])) { continue; }
        const start = i;
        while (i < chars.length && isC(chars[i])) { i++; }
        const end = i;
        const maxR = maxRun(chars.slice(start, end).join(''));
        if (maxR && end - start > maxR) { return { start, end }; }
      }
      return null;
    };

    for (let guard = 0; guard < 10; guard++) {
      const run = findRun();
      if (!run) { break; }
      const len = run.end - run.start;

      // Prefer deleting obstruents (stops/fricatives) in Westron/Khuzdul clusters;
      // Quenya tends to drop glides/h first.
      const runStr = chars.slice(run.start, run.end).join('');
      const runChars = [...runStr];

      const isObstruent = (ch: string) => {
        const c = ch.toLowerCase();
        // placeholders count as "strong" consonants; prefer deleting plain stops first
        if (DigraphGuard.placeholders.includes(ch)) { return false; }
        return /[ptkbdgfszvxq]/i.test(c);
      };

      let offset: number;
      if (profile.name !== 'quenya') {
        // try to delete an obstruent in the run; fall back to sonority if none
        const idx = runChars.findIndex(isObstruent);
        offset = idx >= 0 ? idx : Sonority.pickDeletionIndex(runStr);
      } else {
        offset = Sonority.pickDeletionIndex(runStr);
      }

      const deleteAt = run.start + offset;
      const insertAt = run.start + Math.floor(len / 2);

      if (mode === 'shrink' || !profile.preferEpenthesis) {
        chars.splice(deleteAt, 1);
      } else {
        chars.splice(insertAt, 0, profile.epentheticVowel);
      }
    }

    return DigraphGuard.unprotect(chars.join(''));
  }

  static collapseHiatus(s: string, profile: Profile): string {
    const V = Phonology.vowelClass;

    if (profile.name === 'quenya') {
      // Only fix triple-vowels; preserve normal VV
      const vvv = new RegExp(`(${V})(${V})(${V})`, 'giu');
      return s.replace(vvv, '$1$2'); // drop the 3rd
    }

    // Westron/Khuzdul: collapse VV
    const vv = new RegExp(`(${V})(${V})`, 'giu');
    return s.replace(vv, '$1');
  }

  static enforceFinalShape(s: string, profile: Profile): string {
    let out = s;

    // 1) Quenya: force vowel-final
    // if (!profile.allowFinalConsonants) {
    //   if (!new RegExp(`${Phonology.vowelClass}$`, 'iu').test(out)) {
    //     out += profile.epentheticVowel;
    //   }
    //   return out; // and skip the rest
    // }
    // 1) Quenya: force vowel-final
    if (!profile.allowFinalConsonants) {
      if (!new RegExp(`${Phonology.vowelClass}$`, 'iu').test(out)) {
        // If already near/over max length, prefer truncation over adding a vowel.
        if (out.length >= profile.targetLen[1]) {
          out = out.slice(0, -1);
        } else {
          out += profile.epentheticVowel;
        }
      }
      return out;
    }

    // 2) Westron/Khuzdul: soften only if final consonant run is too long
    const chars = [...out];
    let tailC = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (Phonology.isConsonant(chars[i])) { tailC++; }
      else { break; }
    }
    while (tailC >= 4) { out = out.slice(0, -1); tailC--; }

    // 3) Apply legal finals by trimming (not vowelizing)
    if (profile.legalFinals) {
      // Trim repeatedly until the *coda* (material after the last vowel) matches.
      for (let guard = 0; guard < 8; guard++) {
        if (PhonoUtil.isLegalFinal(out, profile)) { break; }
        if (out.length <= 2) { break; }
        out = out.slice(0, -1);
      }
    }

    return out;
  }

}



type Profile = {
  name: 'westron' | 'khuzdul' | 'quenya';
  epentheticVowel: string;         // 'e' or 'a' etc.
  allowFinalConsonants: boolean;
  preferEpenthesis: boolean;       // vs deletion in CCC repair
  maxConsonantRun: number;         // quenya 2, westron 3, khuzdul 4
  targetLen: [number, number];     // min/max
  targetVowelCount: [number, number];
  easyBridges: string[];
  // legalOnsets: RegExp;             // what onsets are OK (not currently used)
  allowedOnsetClusters: string[];   // if onsetRepair is 'none', these clusters are protected from deletion
  legalFinals: RegExp;             // what codas are OK
  maxWallRun: number;

  onsetRepair?: 'none' | 'epenthesis';
  onsetEpenthesisVowel?: string;   // defaults to epentheticVowel
  onsetRepairAfter?: number;       // usually 1 (insert after first consonant)
  minProtectedPrefix?: number;     // for “don’t delete in first N chars”
  finalNucleusMaxDistance?: number;// for “last vowel must be within N of end”
  maxConsonantRunWithLiquids?: number;
  lenitionLadder?: Record<string, string>;

  preRewrites?: Array<{ pattern: RegExp; replace: string }>;
  // Optional: when true, Syncopater rejects candidates that create illegal clusters.
  strictClusterGating?: boolean;

  // Optional: override allowed cluster inventories for gating (strings like 'nd', 'hl', 'Ɋ', etc.)
  allowedBigrams?: string[];
  allowedTrigrams?: string[];
  // maxConsonantRunAfterVowelDeletion?: number; // default to maxConsonantRun
};


// Deletes the second vowel in words with 3+ vowels, but only if it creates an easy-to-pronounce consonant bridge.
class Syncopater {
  static process(word: string, profile: Profile): string {
    let s = word;

    // const ps0 = DigraphGuard.protect(s); // completely unused?
    const vowelRe = new RegExp(Phonology.vowelClass, 'giu');

    for (let attempt = 0; attempt < 2; attempt++) {
      const ps = DigraphGuard.protect(s);
      const pulses = [...ps.matchAll(vowelRe)];
      if (pulses.length < 3) { break; }
      if (ps.length < 7) { break; }

      let targetIdx = pulses[1].index ?? 0;
      const minPrefix = profile.minProtectedPrefix ?? 0;
      if (targetIdx <= minPrefix) { continue; }

      if (MorphemeGuard.looksLikeSeam(ps, targetIdx)) { break; }

      // choose 'e' if present, still on protected string
      const mid = pulses.slice(1, -1).find(m => (m[0] || '').toLowerCase() === 'e');
      if (mid && mid.index !== null) { targetIdx = mid.index; }

      const before = ps[targetIdx - 1] ?? '';
      const after = ps[targetIdx + 1] ?? '';
      const bridge = (before + after).toLowerCase();

      if (!profile.easyBridges.includes(DigraphGuard.unprotect(bridge))) { break; }

      const candPs = ps.slice(0, targetIdx) + ps.slice(targetIdx + 1);

      // Optional cluster gating: reject candidates that create illegal clusters.
      if (profile.strictClusterGating) {
        const candChars = [...candPs];
        const V = new RegExp(Phonology.vowelClass, 'iu');
        const isC = (c: string) => c !== ' ' && !V.test(c);

        const allowedBigramSet = new Set(
          (profile.allowedBigrams ?? ClusterSmoother.baseAllowedBigrams).map(x =>
            DigraphGuard.protect(x).toLowerCase()
          )
        );

        const allowedTrigramSet = new Set(
          (profile.allowedTrigrams ?? ClusterSmoother.baseAllowedTrigrams).map(x =>
            DigraphGuard.protect(x).toLowerCase()
          )
        );

        // Reject any CCC unless it's explicitly allowed.
        for (let i = 0; i < candChars.length - 2; i++) {
          if (isC(candChars[i]) && isC(candChars[i + 1]) && isC(candChars[i + 2])) {
            const c3 = (candChars[i] + candChars[i + 1] + candChars[i + 2]).toLowerCase();
            if (!allowedTrigramSet.has(c3)) { return s; }
          }
        }

        // Reject any CC not in the allowed bigram set.
        for (let i = 0; i < candChars.length - 1; i++) {
          if (isC(candChars[i]) && isC(candChars[i + 1])) {
            const c2 = (candChars[i] + candChars[i + 1]).toLowerCase();
            if (!allowedBigramSet.has(c2)) { return s; }
          }
        }
      }

      // repair candidate and if it required epenthesis but profile hates that, skip
      const cand = DigraphGuard.unprotect(candPs);
      const repaired = PhonoUtil.breakRuns(cand, profile);
      if (repaired !== cand && !profile.preferEpenthesis) { break; }

      s = cand;
    }
    return s;
  }
}

// Repairs illegal consonant clusters and codas, and ensures at least one vowel exists.
// Repairs illegal consonant clusters and codas, and ensures at least one vowel exists.
class PhonotacticRepair {
  static process(word: string, profile: Profile): string {
    let s = word;

    // 1) fix consonant runs
    s = PhonoUtil.breakRuns(s, profile);

    // 2) fix vowel hiatus
    s = PhonoUtil.collapseHiatus(s, profile);

    // 3) ensure at least one vowel (Khuzdul can still need this occasionally)
    if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }

    // 4) final shape rules
    // IMPORTANT: Don't enforce Quenya vowel-final here.
    // Doing so early "locks in" a stable vowel ending and reduces later erosion.
    if (profile.name !== 'quenya') {
      s = PhonoUtil.enforceFinalShape(s, profile);
    }

    return s;
  }
}

// Assimilation: similar sounds merge together, or a sound changes to become more like a neighboring sound.
class Assimilationist {
  static process(word: string): string {
    let s = word;
    s = s.replace(/np/g, 'mp').replace(/nb/g, 'mb').replace(/mt/g, 'nt');
    s = s.replace(/rl/g, 'll').replace(/nl/g, 'll');
    return s;
  }
}


// Softens stops, but ignores the very first letter to keep identity.
class Lenitioner {
  static process(word: string, profile: Profile): string {
    const ladder = profile.lenitionLadder || {};

    // Work in digraph-protected space so lenition results like "gh" remain a single unit
    // for later cluster logic (prevents outputs like "...ghegh").
    const protectedWord = DigraphGuard.protect(word);
    const protectedChars = [...protectedWord];

    const vowelRe = new RegExp(Phonology.vowelClass, 'iu');
    const isC = (c: string) => c !== ' ' && !vowelRe.test(c);

    const allowedOnsets = new Set(
      (profile.allowedOnsetClusters ?? []).map(x => DigraphGuard.protect(x).toLowerCase())
    );

    const startsWithAllowedCluster =
      protectedChars.length >= 2 &&
      isC(protectedChars[0]) &&
      isC(protectedChars[1]) &&
      allowedOnsets.has((protectedChars[0] + protectedChars[1]).toLowerCase());

    // Stable-ish pseudo-randomness (keep prior behavior)
    const hash = [...protectedChars].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    // If onset CC is protected, begin after it; otherwise begin at index 1.
    const startIndex = startsWithAllowedCluster ? 2 : 1;

    // Context gating: avoid turning final/cluster g->gh, d->th, etc.
    const isV = (c: string) => c !== ' ' && vowelRe.test(c);

    for (let i = startIndex; i < protectedChars.length; i++) {
      const ch = protectedChars[i];

      // Never mutate digraph placeholders; they already represent historical outcomes.
      if (DigraphGuard.placeholders.includes(ch)) { continue; }

      const mapped = ladder[ch];
      if (!mapped) { continue; }

      // Keep the same probabilistic trigger.
      if (Math.abs(hash + i) % 10 >= 3) { continue; }

      const prev = protectedChars[i - 1] ?? '';
      const next = protectedChars[i + 1] ?? '';

      // If the segment is in a consonant-heavy environment, lenition tends to create mess.
      // Prefer lenition mainly between vowels or before a vowel.
      const betweenVowels = isV(prev) && isV(next);
      const beforeVowel = isV(next);

      // Allow some lenition in open syllables; avoid at word-final or before consonants.
      if (!(betweenVowels || beforeVowel)) { continue; }

      // Apply mapped value in protected space so digraphs stay atomic.
      const rep = DigraphGuard.protect(mapped);
      protectedChars.splice(i, 1, ...[...rep]);
      // Adjust loop index if we inserted more than one protected char (rare).
      if (rep.length > 1) { i += rep.length - 1; }
    }

    return DigraphGuard.unprotect(protectedChars.join(''));
  }
}

// Deletes the weakest internal syllable in long words.
class SyllableCruncher {
  static process(word: string): string {
    // Work in digraph-protected space so 'qu' is atomic and its vowel can't be "weakened" to 'e'.
    const pw = DigraphGuard.protect(word);

    const syllables =
      pw.match(new RegExp(`[^${Phonology.vowels}]*[${Phonology.vowels}]+`, 'giu')) || [pw];

    // Start crunching a little earlier; otherwise erosion often does nothing.
    if (syllables.length < 3) { return word; }

    const out = syllables.map((syll, i) => {
      if (i === 0 || i === syllables.length - 1) { return syll; }

      // Only weaken one vowel, and only if the syllable has 2+ vowels or is long
      const vowelMatches = [...syll.matchAll(new RegExp(Phonology.vowelClass, 'giu'))];
      if (syll.length >= 4 || vowelMatches.length >= 2) {
        const idx = vowelMatches[0].index; // weaken first vowel only
        return syll.slice(0, idx) + 'e' + syll.slice(idx + 1);
      }
      return syll;
    }).join('');

    return DigraphGuard.unprotect(out);
  }
}

// Final compression and tail-blunting.
class Toponymizer {
  static process(word: string, profile: Profile): string {
    let s = word;

    if (profile.name === 'westron') {
      // tail blunt only for Westron
      const VOWEL_ENDING = new RegExp(`${Phonology.vowelClass}$`, 'iu');
      // if (s.length > 5) { s = s.replace(VOWEL_ENDING, ''); }
      if (s.length > 5 && VOWEL_ENDING.test(s)) {
        const cand = s.replace(VOWEL_ENDING, '');
        // if we end in harsh consonant, keep a tiny e
        if (/[hxg]$/i.test(cand)) { s = cand + 'e'; }
        else { s = cand; }
      }
    }

    if (profile.name === 'khuzdul') {
      // Khuzdul: never add -ger etc
      s = s.replace(/tz$/i, 'ts');
      return s;
    }

    // shared cleanup
    s = s.replace(/thh$/i, 'th');
    s = s.replace(/ghh$/i, 'gh');
    s = s.replace(/nh$/i, 'n');
    s = s.replace(/tz$/i, 'ts');

    // Westron-only stylistic smoothing
    if (profile.name === 'westron') {
      s = s.replace(/gr$/i, 'ger');
    }

    return s;
  }
}

// Governs the overall length and vowel count of the word, deleting or adding material as needed to fit the profile’s target ranges.
class LengthGovernor {
  static process(word: string, profile: Profile): string {
    let s = word;

    // Protect digraphs during length/vowel operations so we don't mutate inside 'qu', 'th', etc.
    let psS = DigraphGuard.protect(s);

    const tooLong = () => psS.length > profile.targetLen[1] || PhonoUtil.countVowels(psS) > profile.targetVowelCount[1];
    // const tooShort = () => s.length < profile.targetLen[0] || PhonoUtil.countVowels(s) < profile.targetVowelCount[0];
    const minByIdentity = profile.name === 'westron'
      ? Math.max(profile.targetLen[0], Math.floor(word.length * 0.6))
      // : (profile.name === 'quenya'
      //   ? Math.max(profile.targetLen[0], Math.floor(word.length * 0.45))
      //   : profile.targetLen[0]);
      : profile.targetLen[0];

    const tooShort = () => psS.length < minByIdentity || PhonoUtil.countVowels(psS) < profile.targetVowelCount[0];

    // Reduce while too long (cap iterations)
    for (let i = 0; i < 6 && tooLong(); i++) {
      let changed = false;

      // 1) drop a weak internal vowel (prefer 'e', then 'i/u', avoid first+last vowel)
      const vowels = [...psS.matchAll(new RegExp(Phonology.vowelClass, 'giu'))];
      if (vowels.length >= 3) {
        const inner = vowels.slice(1, -1);

        const ranked = [
          ...inner.filter(v => v[0].toLowerCase() === 'e'),
          ...inner.filter(v => /[iuíúū]/i.test(v[0]) && v[0].toLowerCase() !== 'e'),
          ...inner.filter(v => v[0].toLowerCase() !== 'e' && !/[iuíúū]/i.test(v[0])),
        ];

        for (const v of ranked.slice(0, 4)) {
          const idx = v.index;
          const ps = psS;

          if (MorphemeGuard.looksLikeSeam(ps, idx)) { continue; }
          if (this.wouldCreateUglyJoin(DigraphGuard.unprotect(psS), idx)) { continue; }

          const candPs = psS.slice(0, idx) + psS.slice(idx + 1);
          const cand = DigraphGuard.unprotect(candPs);
          // Don't allow length-governed deletions to undershoot identity too hard.
          if (candPs.length < (minByIdentity - 1)) { continue; }
          if (PhonoUtil.countVowels(candPs) < profile.targetVowelCount[0]) { continue; }

          // Safety: don't delete a vowel if it would create an overlong consonant run.
          const runCap = profile.maxConsonantRun;
          const candProtected = candPs;
          const V = new RegExp(Phonology.vowelClass, 'iu');

          let maxRun = 0;
          let curRun = 0;
          for (const ch of [...candProtected]) {
            if (ch !== ' ' && !V.test(ch)) {
              curRun++;
              if (curRun > maxRun) { maxRun = curRun; }
            } else {
              curRun = 0;
            }
          }
          if (maxRun > runCap) { continue; }

          // Inventory gating: avoid creating nasty CC/CCC like "ghdz" (when digraphs are unprotected).
          if (!this.clustersAllowed(candProtected, profile)) { continue; }

          // Apply deletion, then re-repair clusters/hiatus so the pipeline stays gradual.
          s = PhonoUtil.breakRuns(cand, profile, profile.preferEpenthesis ? 'repair' : 'shrink');
          s = PhonoUtil.collapseHiatus(s, profile);
          psS = DigraphGuard.protect(s);
          changed = true;
          break;
        }
      }

      if (!changed) { break; }
    }

    // If too short, pad per profile
    if (tooShort()) {
      if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }
      if (!profile.allowFinalConsonants && !new RegExp(`${Phonology.vowelClass}$`, 'iu').test(s)) {
        s += profile.epentheticVowel;
      }
    }

    // Ensure we return unprotected form.
    s = DigraphGuard.unprotect(psS);
    return s;
  }

  // only pad/enforce finals
  static finalize(word: string, profile: Profile): string {
    let s = word;
    if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }
    return s;
  }

  // Helper: checks if protectedWord (digraph-protected) contains only allowed clusters for the given profile.
  private static clustersAllowed(protectedWord: string, profile: Profile): boolean {
    if (!profile.strictClusterGating) { return true; }

    const V = new RegExp(Phonology.vowelClass, 'iu');
    const isC = (c: string) => c !== ' ' && !V.test(c);

    const allowedBigrams = new Set(
      (profile.allowedBigrams ?? ClusterSmoother.baseAllowedBigrams).map(x =>
        DigraphGuard.protect(x).toLowerCase()
      )
    );

    const allowedTrigrams = new Set(
      (profile.allowedTrigrams ?? ClusterSmoother.baseAllowedTrigrams).map(x =>
        DigraphGuard.protect(x).toLowerCase()
      )
    );

    const chars = [...protectedWord];

    // Reject any CCC unless explicitly allowed.
    for (let i = 0; i < chars.length - 2; i++) {
      if (isC(chars[i]) && isC(chars[i + 1]) && isC(chars[i + 2])) {
        const c3 = (chars[i] + chars[i + 1] + chars[i + 2]).toLowerCase();
        if (!allowedTrigrams.has(c3)) { return false; }
      }
    }

    // Reject any CC not explicitly allowed.
    for (let i = 0; i < chars.length - 1; i++) {
      if (isC(chars[i]) && isC(chars[i + 1])) {
        const c2 = (chars[i] + chars[i + 1]).toLowerCase();
        if (!allowedBigrams.has(c2)) { return false; }
      }
    }

    return true;
  }

  private static wouldCreateUglyJoin(s: string, idx: number): boolean {
    const ps = DigraphGuard.protect(s);
    const V = new RegExp(Phonology.vowelClass, 'iu');

    const left = ps[idx - 1] ?? '';
    const right = ps[idx + 1] ?? '';
    if (!left || !right) { return false; }
    if (V.test(left) || V.test(right)) { return false; }

    if (left.toLowerCase() === right.toLowerCase()) { return true; } // kk/gg/etc

    // compute actual run length across the seam after deletion
    const deleted = ps.slice(0, idx) + ps.slice(idx + 1);
    let runLen = 0;

    // count consonants to the left of seam
    for (let i = idx - 1; i >= 0; i--) {
      if (V.test(deleted[i]) || deleted[i] === ' ') { break; }
      runLen++;
    }
    // count consonants to the right of seam
    for (let i = idx; i < deleted.length; i++) {
      if (V.test(deleted[i]) || deleted[i] === ' ') { break; }
      runLen++;
    }

    return runLen >= 4; // this is now “real” seam run, not nearby noise
  }
}

class GeminateNormalizer {
  static process(word: string, profile: Profile): string {
    let s = word;

    // Always fix these bug-looking cases
    s = s.replace(/hh/gi, 'h');

    if (profile.name === 'khuzdul') {
      // keep some gemination, but avoid hard-stop doubles inside clusters: ...CkkC...
      const V = new RegExp(Phonology.vowelClass, 'iu');
      const ps = DigraphGuard.protect(s);

      s = DigraphGuard.unprotect(
        ps.replace(/([^ ])([ptkbdg])\2([^ ])/gi, (m, a, b, c) => {
          // only collapse if neighbors are consonant-ish (not vowels)
          if (!V.test(a as string) && !V.test(c as string)) { return a + b + c as string; }

          return a + b + b + c as string; // keep if it's between vowels (rare here)
        })
      );

      // optional: collapse long vowel runs as you already do
      s = s.replace(new RegExp(`(${Phonology.vowelClass})\\1+`, 'gi'), '$1');
      // If tz follows a geminate stop, collapse it (…ttz… → …tz…)
      s = s.replace(/([ptkbdg])\1tz/gi, '$1tz');
      // and if tz precedes a geminate stop (…tzt… → …tz…)
      s = s.replace(/tz([ptkbdg])\1/gi, 'tz$1');
      return s;
    }

    if (profile.name === 'quenya') {
      // Keep Quenya-friendly geminates
      const keep = new Set(['ll', 'nn', 'mm', 'ss', 'rr', 'tt']);
      // Replace any double consonant not in keep
      s = s.replace(/([b-df-hj-np-tv-z])\1/gi, (m) => (keep.has(m.toLowerCase()) ? m : m[0]));
      return s;
    }

    // Westron: collapse most geminates (except maybe 'll' and 'ss' if you like)
    s = s.replace(/([b-df-hj-np-tv-z])\1/gi, '$1');
    return s;
  }
}

class ClusterSmoother {
  // Commonly acceptable clusters (expand per taste)
  static baseAllowedBigrams = [
    'st', 'sp', 'sk', 'sw', 'nd', 'nt', 'nk', 'ng', 'mp', 'mb', 'ld', 'rd', 'rt', 'lt', 'rm', 'rn', 'lm',
    'th', 'sh', 'ch', 'ph', 'kh', 'gh',
    // Quenya: tolerate more compound seams without epenthetic a
    'tr', 'dr', 'mr', 'nr', 'ml', 'nl', 'mb', 'mp', 'nt', 'nd', 'ld', 'rd', 'rt', 'lt',
    'll', 'nn', 'mm', 'ss', 'rr', 'tt',
    'xl', 'xr', 'xw', 'lx', 'rx',
    'dh', 'gw',
    'nqu', 'ngw',
    // Westron-specific: allow common onset clusters as legal CC everywhere
    'br', 'bl', 'fr', 'fl', 'pr', 'pl', 'dr', 'gr', 'kr', 'tr', 'cl', 'cr', 'gl', 'gn',
    'sl', 'sm', 'sn'
  ];

  static baseAllowedTrigrams = ['str', 'spr', 'skr', 'swr', 'thr', 'ndr', 'ntr'];

  static allowedBigramSet = new Set(
    ClusterSmoother.baseAllowedBigrams.map(x =>
      DigraphGuard.protect(x).toLowerCase()
    )
  );

  static allowedTrigramSet = new Set(
    ClusterSmoother.baseAllowedTrigrams.map(x =>
      DigraphGuard.protect(x).toLowerCase()
    )
  );

  private static allowedOnsetSet(profile: Profile): Set<string> {
    return new Set(
      (profile.allowedOnsetClusters ?? []).map(x => DigraphGuard.protect(x).toLowerCase())
    );
  }

  private static isProtectedOnsetPair(chars: string[], idx: number, profile: Profile): boolean {
    if (idx !== 0) { return false; }
    if (chars.length < 2) { return false; }
    const pair = (chars[0] + chars[1]).toLowerCase();
    return this.allowedOnsetSet(profile).has(pair);
  }

  static process(word: string, profile: Profile): string {
    // Work on protected form so th/kh/sh count as one unit
    let s = DigraphGuard.protect(word);
    const chars = [...s];

    const V = new RegExp(Phonology.vowelClass, 'iu');
    const isC = (c: string) => c !== ' ' && !V.test(c);

    const allowedBigramSet = new Set(
      (profile.allowedBigrams ?? ClusterSmoother.baseAllowedBigrams).map(x =>
        DigraphGuard.protect(x).toLowerCase()
      )
    );

    const allowedTrigramSet = new Set(
      (profile.allowedTrigrams ?? ClusterSmoother.baseAllowedTrigrams).map(x =>
        DigraphGuard.protect(x).toLowerCase()
      )
    );

    const pickDeletionIndex = (a: string, b: string, c: string, profile: Profile) => {
      // Prefer deleting weak consonants for Khuzdul
      const weak = new Set(['h', 'w', 'y', 'r', 'l', ...DigraphGuard.placeholders]);
      if (profile.name === 'khuzdul') {
        if (weak.has(a.toLowerCase())) { return 0; }
        if (weak.has(b.toLowerCase())) { return 1; }
        if (weak.has(c.toLowerCase())) { return 2; }
      }
      return 1; // middle by default
    };

    // Apply multiple passes; cap to avoid infinite churn
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;

      for (let i = 0; i < chars.length - 1; i++) {
        if (!isC(chars[i]) || !isC(chars[i + 1])) { continue; }

        const c2 = (chars[i] + chars[i + 1]).toLowerCase();

        // Never alter an explicitly-allowed onset cluster.
        if (this.isProtectedOnsetPair(chars, i, profile)) {
          continue;
        }

        // If a profile enables strict gating, actively repair illegal CC (not just CCC).
        // This prevents outputs like "...ghdz..." where digraphs make the run look short.
        if (profile.strictClusterGating && !allowedBigramSet.has(c2) && profile.name !== 'quenya') {
          const a = chars[i];
          const b = chars[i + 1];
          const del = Sonority.score(a) <= Sonority.score(b) ? i : i + 1;
          chars.splice(del, 1);
          changed = true;
          break;
        }

        // Quenya hates most CC unless in allowedBigramSet
        if (profile.name === 'quenya' && !allowedBigramSet.has(c2)) {
          // Quenya-ish assimilation/deletion helpers
          if (c2 === 'tn') { chars.splice(i, 1); changed = true; break; } // tn -> n (drop t)  OR choose nt
          if (c2 === 'kn') { chars[i] = 'n'; changed = true; break; }     // kn -> nn-ish (then geminate normalizer handles)

          // quick assimilation fixes
          if (c2 === 'mt') { chars[i] = 'n'; changed = true; break; }      // mt -> nt
          if (c2 === 'dt') { chars.splice(i, 1); changed = true; break; }  // dt -> t
          if (c2 === 'nl' || c2 === 'rl') { chars[i] = 'l'; changed = true; break; } // -> ll

          const leftV = V.test(chars[i - 1] ?? '');
          const rightV = V.test(chars[i + 2] ?? '');
          // Treat “nearly overlong” as overlong to bias Quenya toward deletion instead of vowel-spray.
          const overLong = chars.length >= (profile.targetLen[1] - 1);

          // 0) If overlong, delete (don't add vowels)
          if (overLong) {
            const a = chars[i], b = chars[i + 1];
            const del = Sonority.score(a) <= Sonority.score(b) ? i : i + 1;
            chars.splice(del, 1);
            changed = true;
            break;
          }

          // 1) If NOT VCCV, prefer deletion (avoid "a-spray")
          if (!(leftV && rightV)) {
            chars.splice(i + 1, 1);
            changed = true;
            break;
          }

          // 2) Now we KNOW it's VCCV. Before epenthesis, try Quenya-ish fixes:

          // 2a) Glide-loss: V (w|y) (n|m|l|r) V  => drop the glide
          const a = (chars[i] ?? '').toLowerCase();
          const b = (chars[i + 1] ?? '').toLowerCase();
          const isGlide = (x: string) => x === 'w' || x === 'y';
          const isSon = (x: string) => x === 'n' || x === 'm' || x === 'l' || x === 'r';
          if (isGlide(a) && isSon(b)) {
            chars.splice(i, 1);
            changed = true;
            break;
          }

          // 2b) If it is a stop+sonorant, try dropping the stop (often nicer than inserting "a")
          const isStop = (x: string) => /[ptkbdg]/i.test(x);
          if (isStop(a) && isSon(b)) {
            chars.splice(i, 1);
            changed = true;
            break;
          }

          // 3) Otherwise: true Quenya epenthesis in VCCV
          // Insert the epenthetic vowel between the consonants.
          if (chars[i + 1] !== profile.epentheticVowel) {
            chars.splice(i + 1, 0, profile.epentheticVowel);
          }
          changed = true;
          break;
        }

        // For others, tolerate CC; focus on CCC
        if (i < chars.length - 2 && isC(chars[i + 2])) {
          const c3 = (chars[i] + chars[i + 1] + chars[i + 2]).toLowerCase();

          // If the word begins with an allowed onset pair, don't rewrite the initial CCC window either.
          if (i === 0 && this.isProtectedOnsetPair(chars, 0, profile)) {
            continue;
          }

          // If we have C + (allowed CC) + V, treat it like a tolerable boundary and don’t rewrite.
          const next = chars[i + 3] ?? '';
          if (next && V.test(next)) {
            const tail2 = (chars[i + 1] + chars[i + 2]).toLowerCase();
            const onset2 = this.allowedOnsetSet(profile);
            if (allowedBigramSet.has(tail2) || onset2.has(tail2)) {
              continue;
            }
          }

          const overLong = chars.length > profile.targetLen[1];

          if (!allowedTrigramSet.has(c3)) {
            if (profile.name === 'quenya') {
              if (overLong) {
                chars.splice(i + 1, 1);
              } else {
                chars.splice(i + 1, 0, profile.epentheticVowel);
              }
            } else if (profile.preferEpenthesis && profile.name !== 'khuzdul') {
              chars.splice(i + 1, 0, profile.epentheticVowel);
            } else {
              const del = pickDeletionIndex(chars[i], chars[i + 1], chars[i + 2], profile);
              chars.splice(i + del, 1);
            }
            changed = true;
            break;
          }
        }
      }

      if (!changed) { break; }
    }

    s = chars.join('');
    return DigraphGuard.unprotect(s);
  }
}

class PhonoPolicy {
  private static onsetCache: Record<string, Set<string>> = {};

  private static getAllowedOnsetSet(profile: Profile): Set<string> {
    const key = profile.name;
    if (this.onsetCache[key]) { return this.onsetCache[key]; }
    const raw = profile.allowedOnsetClusters ?? [];
    const set = new Set(raw.map(x => DigraphGuard.protect(x).toLowerCase()));
    this.onsetCache[key] = set;
    return set;
  }

  static applyOnsetRepair(word: string, profile: Profile): string {
    if (profile.onsetRepair === 'none') { return word; }

    const ps = DigraphGuard.protect(word);
    const chars = [...ps];
    const V = new RegExp(Phonology.vowelClass, 'iu');
    const isC = (c: string) => c !== ' ' && !V.test(c);

    // Only repair when the word truly begins with CC (or CCC etc).
    if (!(chars.length >= 2 && isC(chars[0]) && isC(chars[1]))) {
      return word;
    }

    // If the initial CC cluster is explicitly allowed, leave it alone.
    const allowed = this.getAllowedOnsetSet(profile);
    const c2 = (chars[0] + chars[1]).toLowerCase();
    if (allowed.has(c2)) {
      return word;
    }

    const after = profile.onsetRepairAfter ?? 1;
    const v = profile.onsetEpenthesisVowel ?? profile.epentheticVowel;

    chars.splice(Math.min(after, chars.length), 0, v);
    return DigraphGuard.unprotect(chars.join(''));
  }

  static enforceFinalNucleus(word: string, profile: Profile): string {
    const maxDist = profile.finalNucleusMaxDistance;
    if (maxDist === null || maxDist === undefined) { return word; }

    const V = new RegExp(Phonology.vowelClass, 'iu');
    const chars = [...word];
    let lastV = -1;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (V.test(chars[i])) { lastV = i; break; }
    }
    if (lastV < 0) { return word + profile.epentheticVowel; }

    if (chars.length - 1 - lastV > maxDist) {
      // inject before last consonant (minimal)
      chars.splice(chars.length - 1, 0, profile.epentheticVowel);
      return chars.join('');
    }
    return word;
  }
}

class Polish {
  static process(word: string, profile: Profile): string {
    let s = word;

    // Fix a couple common pipeline artifacts for Westron.
    if (profile.name === 'westron') {
      s = s.replace(/sd$/i, 'st'); // Fisfasd -> Fisfast
      s = s.replace(/zd$/i, 'st');
      s = s.replace(/nm$/i, 'n');  // Túnunm -> Túnun
    }

    // Re-apply final-shape constraints after cosmetics.
    // (This trims for Westron/Khuzdul, pads for Quenya.)
    // s = PhonoUtil.enforceFinalShape(s, profile);
    s = PhonoUtil.enforceFinalShape(s, profile);
    if (!PhonoUtil.hasVowel(s)) { s += this.getHarmonyVowel(s, profile); }

    s = PhonoPolicy.applyOnsetRepair(s, profile);
    s = PhonoPolicy.enforceFinalNucleus(s, profile);

    // If we somehow stripped all vowels, recover.
    const harmonyVowel = this.getHarmonyVowel(s, profile);
    if (!PhonoUtil.hasVowel(s)) { s += harmonyVowel; }

    return s;
  }

  static getHarmonyVowel(word: string, profile: Profile): string {
    if (profile.name !== 'quenya') { return profile.epentheticVowel; }

    // Count vowels and choose the most frequent "base" vowel.
    // Normalize diacritics so ā/á/â all count as 'a', etc.
    const counts: Record<string, number> = {};
    const matches = word.match(new RegExp(Phonology.vowelClass, 'giu')) || [];

    for (const v of matches) {
      const base = v
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}+/gu, ''); // strip combining marks

      // Keep it simple: if normalization yields multiple letters, take the first.
      const key = base[0] ?? profile.epentheticVowel;

      counts[key] = (counts[key] ?? 0) + 1;
    }

    let best = profile.epentheticVowel;
    let bestN = -1;
    for (const [k, n] of Object.entries(counts)) {
      if (n > bestN) { bestN = n; best = k; }
    }
    return best;
  }
}

const westronOnsets = [
  'bl', 'br', 'cl', 'cr', 'dr', 'dw', 'fl', 'fr', 'gl', 'gr', 'gn', 'kl', 'kr', 'pl', 'pr',
  'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'wr', 'Þr', 'Þw'
];
const quenyaOnsets = [
  'Ɋ',        // qu
  'nw', 'ny',
  'hl', 'hr', 'hy', 'hw',
  'ty', 'ly', 'ry',
  'pl', 'pr', 'tr', 'dr', 'cl', 'cr', 'gl', 'gr'
];

const khuzdulOnsets = [
  'Ҡ', 'Ġ', 'Š', 'Ꚏ',  // kh gh sh tz
  'zg', 'zd', 'zr',
  'br', 'dr', 'gr', 'kr'  // optional, taste
];

const profiles: Record<Profile['name'], Profile> = {
  westron: {
    name: 'westron',
    epentheticVowel: 'e',
    allowFinalConsonants: true,
    preferEpenthesis: false,
    maxConsonantRun: 3,
    targetLen: [4, 8],
    targetVowelCount: [3, 4],
    easyBridges: ['st', 'nt', 'nd', 'rd', 'ld', 'mp', 'nk', 'ns', 'lt', 'rn', 'rm', 'lm', 'rf', 'lf', 'rt'],
    allowedOnsetClusters: westronOnsets,
    legalFinals: /^(?:|n|s|t|m|d|nd|nt|st|mp|nk|ld|rd|rm|rn|lm|lf|rf|gh)$/i,
    maxWallRun: 4,
    minProtectedPrefix: 2,
    onsetRepair: 'epenthesis',
    onsetRepairAfter: 1,
    onsetEpenthesisVowel: 'e',
    finalNucleusMaxDistance: 3,  // if last vowel is >3 from end, inject
    lenitionLadder: { p: 'b', b: 'v', t: 'd', d: 'th', k: 'g', g: 'gh' },
    strictClusterGating: true,
    allowedBigrams: [...new Set([...ClusterSmoother.baseAllowedBigrams, ...westronOnsets])],
    allowedTrigrams: ClusterSmoother.baseAllowedTrigrams,
  },

  quenya: {
    name: 'quenya',
    epentheticVowel: 'a',         // often nicer than 'e'
    allowFinalConsonants: false,
    preferEpenthesis: true,
    maxConsonantRun: 2,
    targetLen: [5, 9],           // 8 is tight; Quenya names are often longer
    targetVowelCount: [2, 6],
    easyBridges: ['nd', 'nt', 'ld', 'rd', 'll', 'nn', 'mm', 'ss', 'rr'],
    allowedOnsetClusters: quenyaOnsets,
    legalFinals: new RegExp(`${Phonology.vowelClass}$`, 'iu'),
    maxWallRun: 3,
    maxConsonantRunWithLiquids: 3,
    minProtectedPrefix: 1,
    onsetRepair: 'epenthesis',
    onsetRepairAfter: 1,
    onsetEpenthesisVowel: 'a',
    lenitionLadder: { t: 'd' },
    preRewrites: [
      { pattern: /x/g, replace: 'ks' },
      { pattern: /kw/g, replace: 'qu' },
    ],
    strictClusterGating: true,
    allowedBigrams: ClusterSmoother.baseAllowedBigrams,
    allowedTrigrams: ClusterSmoother.baseAllowedTrigrams,
  },

  khuzdul: {
    name: 'khuzdul',
    epentheticVowel: 'u',
    allowFinalConsonants: true,
    preferEpenthesis: false,
    maxConsonantRun: 3,
    targetLen: [3, 8],
    targetVowelCount: [2, 3],
    easyBridges: ['st', 'nt', 'nd', 'rd', 'ld', 'mp', 'nk', 'ns', 'lt', 'zg', 'zd', 'kh', 'gh', 'sh'],
    allowedOnsetClusters: khuzdulOnsets,
    // Tighten cluster inventory so vowel deletion can't create nasty sequences like "ghdz".
    // NOTE: intentionally *exclude* "dz".
    allowedBigrams: [
      ...ClusterSmoother.baseAllowedBigrams,
      'zg', 'zd', 'zr'
    ],
    allowedTrigrams: [
      ...ClusterSmoother.baseAllowedTrigrams
    ],
    legalFinals: /^(?:|n|r|s|z|t|nd|nt|st|rk|rd|ld|mb|mp|ng|nk|kh|gh|sh)$/i,
    maxWallRun: 5,
    minProtectedPrefix: 1,
    onsetRepair: 'epenthesis',
    onsetRepairAfter: 1,
    onsetEpenthesisVowel: 'u',
    finalNucleusMaxDistance: 2,     // dwarven words tolerate heavy codas, but not vowelless tails
    lenitionLadder: { t: 'd', k: 'g' },
    strictClusterGating: true,
  },
};


interface Processor {
  name: string;
  process(word: string, profile: Profile): string;
}


export class WordCorruptor {
  static erosionStack: Processor[] = [
    SyllableCruncher,
    Syncopater,
    Lenitioner,
    Assimilationist,
    ClusterSmoother
  ];

  static normalizeStack: Processor[] = [
    // SyllableCruncher,
    // Syncopater,
    // Lenitioner,
    // Assimilationist,
    // ClusterSmoother,
    PhonotacticRepair,
    LengthGovernor,
    Toponymizer,
    GeminateNormalizer,
    Polish
  ]

  static mutate(
    word: string, languageKey: 'westron' | 'khuzdul' | 'quenya'
  ): string {
    const profile = profiles[languageKey];
    // console.warn(`Original: "${word}" (${profile.name})`);

    let s = word.toLowerCase().trim();

    if (profile.preRewrites) {
      for (const r of profile.preRewrites) {
        s = s.replace(r.pattern, r.replace);
      }
    }

    const erosionDepth = 5;
    for (let i = 0; i < erosionDepth; i++) {
      // const step = this.erosionStack[i % this.erosionStack.length];
      this.erosionStack.forEach(step => {
        // const sBefore = s.toLowerCase().trim();
        s = step.process(s, profile);
        // const stepName = step.name;
        // console.warn(` - ${stepName}: "${sBefore}" => "${s.toLowerCase().trim()}"`);
      });
    }

    this.normalizeStack.forEach(step => {
      // const sBefore = s.toLowerCase().trim();
      s = step.process(s, profile);
      // const stepName = step.name;

      // console.warn(` - ${stepName}: "${sBefore}" => "${s.toLowerCase().trim()}"`);
    });

    s = PhonoUtil.breakRuns(s, profile, 'repair');

    // Final cleanups
    s = s.replace(/tth/gi, 'th');
    // If 'qu' ever got split (should be rare now), repair any stray 'q' into 'qu'.
    s = s.replace(/q(?!u)/gi, 'qu');

    const forbiddenXY = ['tz', 'zh', 'sh', 'gh', 'kh', 'th', 'ts'];
    for (const xy of forbiddenXY) {
      const re = new RegExp(xy + xy, 'gi');
      s = s.replace(re, xy);
    }

    const ret = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    console.warn(`"${word}" => "${ret}" (${profile.name})`);
    return ret;
  }

}