---
name: "graphql-contract-guard"
description: "Order of operations when adding or changing any ACF field, CPT, taxonomy, or GraphQL query on the Crane Yadak project. Use when adding a field to ACF, registering a post type or taxonomy, connecting a CPT to a taxonomy, writing or editing any GraphQL query in src/lib, or when a build shows 'Cannot query field X on type Y'. Names which checker enforces which rule, so the agent runs the check instead of trusting memory."
---

# GraphQL contract — sequence, not reminders

## Why this skill is short

Its first version listed three rules to "verify". That was a placebo: a
prompt asking a model to remember something is the weakest enforcement
there is, and this project's own `CLAUDE.md` says so — *"good intentions
and memory are not guarantees; a test is."*

All three rules are now **code** in `scripts/check-architecture.mjs`,
which runs on every `npm run check` and breaks the build:

| Rule | Enforced by |
|---|---|
| ACF group's `graphql_types` matches the real CPT type name | check 0 |
| Every field a query selects exists in the ACF tree | check 0ج |
| A CPT is in the taxonomy's `object_type` before a query selects that connection | check 7 |

So this skill's job is **not** to restate them. It's the part a checker
can't do: the order you do things in, and what to do when a check fires.

## Order of operations

Adding a field, CPT, taxonomy or connection — always this order:

1. **WordPress first.** Register the field / CPT / taxonomy in the plugin.
   For a CPT↔taxonomy connection, put the CPT in the taxonomy's own
   `object_type` array inside `register_taxonomy()`.
2. **Bump `modified`** in the ACF JSON. Without it ACF never offers Sync
   and the edit is permanently inert.
3. **Run `npm run check`.** It passes against the *new* WordPress shape
   before any frontend code exists.
4. **Then** write the query — and give a new field its own rung on the
   query ladder, never inside `CORE_FIELDS`.
5. **Run `npm run check` again**, then `npm run build`.

⚠️ Never `register_taxonomy_for_object_type()` from another file's `init`
hook. It returns `false` silently when the taxonomy doesn't exist yet,
and hook priority decides whether it does. This exact pattern killed the
whole Q&A feature: the CPT registered at priority 5, the taxonomy at 10.

## When a build says "Cannot query field X on type Y"

Work down this list — it is ordered by how often each was the cause here:

1. Is the CPT in the taxonomy's `object_type` array? (check 7 catches this)
2. Does the ACF group's `graphql_types` use the `graphql_single_name`,
   capitalised? `craneBrand` → `CraneBrand`, never `Brand`.
3. Does the ACF JSON have a `modified` key, and has the client clicked
   Sync?
4. Is the query one level too shallow? A group containing a repeater
   needs two levels: `contentBlocks { contentBlocks { … } }`.
5. Is the field registered with `register_graphql_field`? Custom post
   meta is **not** exposed automatically.

## The query ladder, and its one blind spot

Every fetch module tries a full query, then a reduced one. It protects
against a *new field* missing on an older plugin.

⚠️ It does **not** protect against a broken connection, because both
rungs request it. When the Q&A connection broke, both rungs failed
identically and the section went silently dark. If a ladder's rungs share
the field you're worried about, the ladder is not covering you — a
checker is.

## Before trusting any checker

Run it against **known-broken input**, not only healthy input. Check 7
itself passed green through four iterations while blind:

- it only matched `register_post_type('literal')`, and the questions CPT
  uses a constant;
- it read `${CORE}` literally instead of expanding the fragment;
- it grabbed the `{` inside `where: { … }` instead of the selection set;
- a relaxed regex then matched `unregister_post_type`.

Four green runs, four blind spots. Break the thing on purpose, confirm
the checker fails, then restore.
