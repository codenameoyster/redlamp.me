# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `codenameoyster/redlamp.me`. Use the `gh` CLI. Run issue commands from this clone or pass `--repo codenameoyster/redlamp.me`.

## Conventions

- Create: `gh issue create --title "..." --body "..."`. For multiline bodies, use `--body-file -` with a heredoc.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels,comments`. Apply label and state filters as needed.
- Create a sub-issue: `gh issue create --parent <parent> --title "..." --body "..."`.
- Link an existing sub-issue: `gh issue edit <parent> --add-sub-issue <child>`.
- Comment: `gh issue comment <number> --body "..."`.
- Add a label: `gh issue edit <number> --add-label "..."`.
- Remove a label: `gh issue edit <number> --remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means read the GitHub issue and its comments.

## Wayfinding operations

Use one parent issue as the map and its sub-issues as tickets.

- Map: apply `wayfinder:map`. Keep the Notes, Decisions-so-far, and Fog sections in its body.
- Ticket: link it as a sub-issue of the map. Apply `wayfinder:<type>`, where the type is `research`, `prototype`, `grilling`, or `task`. If sub-issues are unavailable, add it to a task list in the map and put `Part of #<map>` at the top of the ticket body.
- Blocking: use native issue dependencies with `gh issue edit <child> --add-blocked-by <blocker>`. If dependencies are unavailable, put `Blocked by: #<number>, #<number>` at the top of the ticket body.
- Next ticket: list the map's open sub-issues or task-list entries in map order. Select the first ticket with no assignee and no open blockers. The `issue_dependencies_summary.blocked_by` field counts open native blockers. For text dependencies, check each referenced issue.
- Claim: run `gh issue edit <number> --add-assignee @me` as the session's first write.
- Resolve: comment with the result and close the ticket. Add a short summary and link to the map's Decisions-so-far section.
