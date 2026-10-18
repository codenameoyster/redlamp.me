# Domain docs

## Layout

Use a single-context layout: `GLOSSARY.md` at the repo root and architecture decision records (ADRs) in `docs/adr/`.

## Before exploring code

1. Read `GLOSSARY.md` if it exists.
2. Read ADRs that apply to the area you will change.

If these paths are absent, continue silently. The `/domain-modeling` skill creates domain docs when terms or decisions are resolved.

## Use glossary terms

Use the glossary's terms in issue titles, proposals, hypotheses, and test names.

If a concept is missing, check whether an existing term applies. Record a real vocabulary gap for `/domain-modeling`.

## Report ADR conflicts

If a proposed change conflicts with an ADR, identify that ADR and explain why its decision needs review.
