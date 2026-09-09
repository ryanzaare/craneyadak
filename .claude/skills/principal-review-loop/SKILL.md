---
name: "principal-review-loop"
description: "Mandatory self-review loop to run before presenting any code, page, or content as \"final\" or \"done.\" Applies a third-person principal-level critique (SEO expert persona + separately a principal software engineer persona), scores the work 1-100, and iterates fixes until the score is 100 or a genuine external blocker is hit. Use for every file written or edited on the Crane Yadak project, and generally for any coding/content task where the user wants highest-possible quality before delivery."
---

## Principal Review Loop (mandatory before calling anything "final")

The baseline standard for all code and content on this project (and by default, any project where the user wants top-tier quality) is: nothing gets presented as finished until it has survived two independent self-review loops — an SEO loop and a debugging/engineering loop — plus a final adversarial panel review (see below). This is not optional polish, it's part of doing the task correctly.

General rule underneath both loops: **write and ship at the highest level of programming practice in every dimension** — correctness, performance, security, readability, maintainability, accessibility, and (for this project specifically) SEO. "It works" is not the bar. "A principal engineer would sign off on this without comment" is the bar.

### How to run a loop
After writing or meaningfully editing a file:
1. Step out of the "author" role and into a **reviewer** role — a distinct, skeptical third-person persona ("imagine an outside principal-level SEO expert / principal software engineer, with no investment in defending this code, reviewing it cold").
2. That reviewer produces a numeric score from 1–100 for the relevant dimension, plus a specific list of what's costing points. Vague scores ("looks good, 95") are not acceptable — every point deducted must map to a concrete, named issue.
3. Fix every issue raised.
4. Re-run the review as the same skeptical persona on the updated version.
5. Repeat until the score is 100, OR until a genuine external blocker is hit (see "Safety valve").
6. Only after both loops independently reach 100 — or are explicitly blocked with a stated reason — proceed to the final panel review.

**This must be an actual iterative loop.** A single review pass, scored once and reported, does not satisfy this skill even if the score is high. If only one pass was run, say so explicitly rather than presenting the score as the output of a completed loop.

Do the loop silently/internally as part of the work — don't narrate every intermediate score in exhausting detail, but do report the final scores and any unresolved blockers when presenting the result.

### Loop A — SEO Review
Persona: a principal-level SEO expert auditing this file with no prior context, using the full `seo-audit-checklist` skill as the scoring rubric (crawlability, performance impact, on-page, structured data, keyword cannibalization, architecture, mobile/UX, E-E-A-T, technical hygiene, RTL/local specifics, monitoring hooks). Score reflects how many checklist items are fully satisfied vs missing/partial. A single fabricated or fake data point (mock schema, placeholder claimed as real, invented rating, invented "most searched" term, hand-typed file size) is an automatic hard cap at a failing score regardless of everything else — fake data is disqualifying, not a minor deduction, because it actively harms the site's real goal.

### Loop B — Debugging / Engineering Review
Persona: a principal software engineer doing a cold code review. Checks: does it actually run/build (mentally trace or, when possible, actually execute/build it rather than assuming); correctness of logic and edge cases; type safety; error handling (including failure states, empty states, network failures for anything fetching data); no dead code or leftover debug artifacts; **no non-functional UI — every form, filter, and control must actually do what it appears to do** (a form whose parameters are silently ignored by its target page is a critical bug, not a cosmetic one); no silent failures; consistent with the project's existing patterns and stack choices; security (no exposed secrets, validated/sanitized inputs); performance (no obviously wasteful re-renders, queries, or bundle bloat); accessibility where applicable. Where feasible, actually run the build/dev server or relevant tests rather than only reasoning about the code — a static read-through catching "should work" is weaker evidence than actually executing it.

### Final gate — the adversarial panel
After both loops pass, imagine a panel of very strict third-party reviewers with no stake in defending the work, all rating the project:
- a **senior/principal software engineer**
- a **senior SEO specialist**
- the **CEO of a world-class competitor** (someone who would be threatened by this site succeeding, and who will instinctively look for why it won't)
- a second **senior programmer** reviewing independently

Ask, honestly: **would all of them say this is the best solution? Would they say this is genuinely the best in its category?**

If the answer is no — or even "probably not, because…" — the work is not finished. Go back and try again, and again, and again, until it would clear that panel. Do not present work as final on the grounds that it is "good enough," "much better than before," or "meets the requirements." The bar is *best*, judged by people looking for reasons to reject it.

When reporting to the user, state what this panel would still object to, if anything.

### Safety valve — don't fake a 100
If a score can't reach 100 because of something outside the code itself — real product data isn't available yet, a design asset hasn't been provided, a backend endpoint doesn't exist yet, the site isn't deployed so Core Web Vitals cannot be measured — do not manufacture a fake fix to force the number up (that would violate the project's no-fake-data rule and the whole point of this loop). Instead: cap the loop at a reasonable number of iterations (roughly 5), stop, and clearly report the exact score reached, exactly what's blocking the remaining points, and what real-world input is needed to close the gap. A well-documented 92 with a clear list of external blockers is honest and useful; a fabricated 100 is a failure of the entire exercise.

**Never state an unmeasured metric as if it were measured.** Site speed, Core Web Vitals, and Lighthouse scores require an actual run against a live URL. Architectural reasoning about why something *should* be fast is not a score and must not be presented as one.

### Reporting to the user
When presenting finished work, briefly state: final SEO loop score, final debugging loop score, how many iterations were actually run, whether the adversarial panel would sign off, and — if anything didn't reach 100 — the specific blocker(s) preventing it.

