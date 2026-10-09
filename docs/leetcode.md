# LeetCode notebook

The private notebook at `https://redlamp.me/leetcode` supports one parent and one student. Use LeetCode for code runs and submissions. Use this notebook for explanations, saved attempts, homework, feedback, lessons, and review reminders.

The application uses the existing Worker, one D1 database, React, and Bun. Workers Free and D1 Free require no billing subscription for this setup. Long answers of the AI tutor can need Workers Paid. See [AI tutor](#ai-tutor).

## Local setup

Install Bun and a current Node.js release. Install the pinned dependencies:

```sh
bun install --frozen-lockfile
```

Generate the two accounts in an interactive terminal. Replace the example usernames with two distinct names. Use 3-40 letters, digits, dots, dashes, or underscores.

```sh
umask 077
mkdir -p .wrangler
bun run credentials parent-name student-name > .wrangler/leetcode-accounts.json
```

The command shows two generated 24-character passwords on the terminal. Save them in a password manager. Standard output contains the usernames and password digests. Keep that JSON file private. This digest format requires the generated high-entropy passwords.

For a new checkout, create `.dev.vars` with these values:

```sh
printf 'LEETCODE_ACCOUNTS=%s\nLEETCODE_LOCAL_HTTP=1\n' "$(cat .wrangler/leetcode-accounts.json)" > .dev.vars
```

If `.dev.vars` already exists, set these two values in that file. Preserve its other values. Both `.dev.vars` and `.wrangler/` are ignored by Git. The local HTTP setting enables a separate development cookie on `localhost` and `127.0.0.1`.

Apply the local migrations. Then start development:

```sh
bunx wrangler d1 migrations apply redlamp-leetcode --local
bun run dev
```

Open `http://localhost:8787/leetcode`. Wrangler builds the browser assets and watches `src/`, `web/`, `shared/`, and `public/`. The build copies the public site files from `public/` to `dist/`.

## Use the notebook

- Add a LeetCode problem. Paste its URL in **Add a problem**. The notebook fills the number, title, difficulty, and topics from LeetCode. If LeetCode does not answer, enter them yourself.
- As the student, start a draft. A draft can hold one or more approaches. The editor autosaves changed content. Use **Save attempt** to preserve an immutable copy.
- Record LeetCode acceptance and understanding separately. An accepted solution can still need practice.
- As the parent, create homework on the **Homework** page. Give it a title, instructions, and an optional due date. Use **Edit homework** to change these details later.
- On the homework page, use **Add a task** to add a problem from the library. Each task has its own review state. A problem can have only one active task in all homework.
- The parent can link lessons to problems and homework. A task page shows the lessons of its homework.
- As the student, open a task from **Today**, the homework page, or the problem page. Submit an exact attempt for review. The parent can request another attempt or complete the task.
- A red dot before a homework or a task shows a message or a review decision from the other account that you did not read. Open the discussion of the task or the problem to remove the dot.
- Use **Recall this problem** to practise before revealing saved work. Record the result. Choose the next review date.
- **Archive problem** moves a problem to **Archived problems** in the library and blocks new homework tasks for it. **Restore problem** returns it.
- If a save fails, keep the page open. Use **Retry save** or **Copy unsaved work**. Reload recovery is available in the same tab when browser session storage works. Conflicting edits require an explicit choice of the server copy.

## HTML lessons

The parent can upload `.html` or `.htm` files. Each file must be valid UTF-8 and at most 1,000,000 bytes. Embed CSS, JavaScript, images, fonts, and media in the file. External scripts, relative files, network APIs, and persistent browser storage are unavailable.

The viewer permits inline JavaScript in an isolated frame. Its HTTP content security policy also applies to full-page display. Both display and download require login. **Download original** returns the uploaded UTF-8 bytes. Archive hides lessons from new links while preserving existing links. Upload a new lesson to change its HTML content.

For the student, the Worker adds a short script at the end of each lesson. This applies to uploaded lessons and set lessons. In the frame, the script shows **Explain with AI** below the selected text. Ctrl+Enter or Cmd+Enter does the same. The AI tutor then explains the selected text. When an answer quotes the lesson, **Show in the lesson** marks the passage in the frame. In full-page display, the script does nothing. **Download original** and the display for the parent do not contain the script. A script in an uploaded lesson can also send an explain request. This request uses the ChatGPT plan of the parent, and the parent can read it in the chat.

## Learning sets

A learning set is a lesson and a list of LeetCode problems about one subject. The sets are content in the repository. A deployment publishes them. The **Sets** page is read-only for both roles.

A set page shows the lesson in an isolated frame, the reading links, and the problems in stages. A problem row shows **Accepted** when the library problem has an accepted saved attempt. A problem row with an active homework task shows the task state. The state links to the task.

As the parent, use **Add to homework** on a problem row. The dialog shows the active homework. Use the search box to find homework by title. Use **Assign** to add the problem to that homework. Use **Create and assign** to create new homework with the problem in one step. The notebook adds the problem to the library when the library does not have it. A problem with an active task has no **Add to homework** button.

The parent can also link a set to a problem or to homework. Choose the set in the **Sets** group of **Related lesson**. The link opens the set page.

To add a set:

1. Create the folder `src/leetcode/sets/<slug>/`. Use lowercase letters, digits, and dashes in the slug.
2. Write `set.ts`. Export the set data as the default export. Type it with `satisfies LearningSet`. For each task, use the problem slug from its LeetCode URL.
3. Write `lesson.html`. Use one self-contained UTF-8 file of at most 1,000,000 bytes. The rules for uploaded lessons apply.
4. In `src/leetcode/sets/index.ts`, import the set and its lesson. Add them to `sets`. The order of `sets` is the display order.
5. Run `bun run test`. `test/sets.test.ts` checks each set: unique set and task slugs, the LeetCode slug format, a stage for each task, https links, and the lesson size.

## AI tutor

The AI tutor uses the parent's ChatGPT plan through Sign in with ChatGPT. The plan must be ChatGPT Plus or Pro. The Worker keeps the ChatGPT tokens in D1. It encrypts them with AES-GCM and the key in the `TUTOR_TOKEN_KEY` secret. The tokens never go to the browser.

OpenAI permits plan usage for open-source and locally hosted apps. For a remotely hosted app, OpenAI asks for the [interest form](https://openai.com/form/sign-in-with-chatgpt-interest/). A Worker is a remotely hosted app. The student also uses the plan of the parent. The parent decides if these conditions are acceptable.

Create the key and upload it:

```sh
openssl rand -base64 32 | bunx wrangler secret put TUTOR_TOKEN_KEY
```

For local development, add `TUTOR_TOKEN_KEY=<value>` to `.dev.vars`. Use a value from `openssl rand -base64 32`. A missing key or a key that is not 32 bytes stops the tutor with "The AI tutor needs configuration."

Apply the remote migrations and upload the secret before you upload a preview version. A preview version uses the production database. It gets only the secrets that exist when you upload it.

To connect ChatGPT:

1. As the parent, open **AI tutor** and select **Continue with ChatGPT**.
2. Open the ChatGPT sign-in page and approve access. The browser then shows an error page for `127.0.0.1`. This is expected.
3. Copy the full address from that page. Paste it in **Address from the error page** and select **Connect**. Do this at once: the sign-in expires after 10 minutes, and the code in the address is valid for a short time.

After the connection, select the model in **Model**. The list contains the models of the plan. A new connection reads the list again. It keeps the selected model when the new list contains it.

The tutor gives hints. It does not write the solution, also when the student asks for it. For a new question about how to solve a problem, it asks one guiding question. When the student asks for more help, it names the idea, then gives the key step on a small example, and then names the parts of the function. When the student asks it to check the code, it tells about one bug in each answer and gives a small input that shows the bug. It does not write the corrected code. The rules are in `src/leetcode/tutor-prompt.txt`.

Each problem, set and lesson has one chat. A task page shows the chat of its problem. The student selects **Ask AI** on these pages. On a screen of 1400 px and wider, the chat panel stays open beside the page, also on the next page. On a smaller screen, the panel opens over the page. Ctrl+Enter or Cmd+Enter sends the message. The parent selects **Read AI chat** on the same pages, or opens a chat from **Chats** on the **AI tutor** page. On a set or lesson page, the student can also select text in the lesson and choose **Explain with AI**. See [HTML lessons](#html-lessons).

Only the student can send questions. The parent can read every chat. The notebook keeps a turn only when the answer is complete. If an answer stops, the student sends the question again.

Each question of the student goes to OpenAI under the ChatGPT account of the parent, with the earlier messages of the chat and the context of the open page. This context can contain the problem, the LeetCode statement, the homework instructions, the notes and code of the student, and the lesson text. The tutor uses the same plan limits as the parent's own ChatGPT and Codex use. On ChatGPT Plus, all apps share one five-hour limit. Use **Manage usage** to see the usage.

The Worker reads each part of a streamed answer, so the CPU time of a turn increases with the length of the answer. On the deployed Worker, send a question on the page with the largest lesson and get a long answer with a diagram. Make sure that the answer arrives in parts. Then read the CPU time of the request in the Cloudflare dashboard. If long answers exceed the Workers Free limit of 10 ms CPU per request, use Workers Paid.

The connection stays valid while the tutor is in use. After 30 days with no tutor use, the refresh token expires. Then connect again.

**Disconnect** revokes the ChatGPT tokens and removes them from D1. If ChatGPT does not confirm the revocation, remove the app in the ChatGPT settings. OpenAI does not tell the notebook about a removal in the ChatGPT settings.

To rotate the key, select **Disconnect** before you upload a new key, so that ChatGPT revokes the old tokens. Then upload the new `TUTOR_TOKEN_KEY` and connect again. If you changed the key first, the page still shows Connected: select **Disconnect**, and then remove the app in the ChatGPT settings.

## Levels and badges

The notebook uses the Arcade theme. Dark is the default appearance. Use the appearance button in the top bar to change to light and back. The browser keeps the choice.

The top bar shows the level and the progress to the next level. The bar is hidden on screens of 620 px or less. **Today** shows the level, the XP, and the badges.

The notebook calculates XP from saved records. The XP does not decrease. Archived problems keep their XP.

| Source | XP |
|---|---|
| A problem with an accepted saved attempt, one time for each problem | easy 10, medium 20, hard 40 |
| An accepted problem with a saved attempt or a review with the understanding "independent", one time for each problem | 10 |
| A completed homework task | 15 |
| A review, one time for each problem and day | 5 |

Level L starts at `50 * L * (L - 1)` XP: level 2 at 100 XP, level 3 at 300 XP, level 4 at 600 XP, and level 5 at 1000 XP.

A badge stays earned. The student and the parent see the same badges.

| Badge | Rule |
|---|---|
| First accept | One problem with an accepted saved attempt. |
| 3-day streak | Saved attempts on three consecutive days. The notebook uses UTC dates. |
| First hard | One hard problem with an accepted saved attempt. |
| Ten accepted | Ten problems with an accepted saved attempt. |
| Independent five | Five accepted problems with the understanding "independent". |
| Set cleared | An accepted saved attempt for each problem of one learning set. |

The student selects the acceptance and the understanding, so the XP shows what the student records. The **Today** counts do not include archived problems, so they can be different from the XP.

## Cloudflare setup

Use an account with Workers Free and D1 Free. Check the account's existing usage before deployment. The application uses no R2 storage or paid service.

Authenticate Wrangler:

```sh
bunx wrangler login
```

The `[[d1_databases]]` binding in `wrangler.toml` contains the ID of the production database. To use a new database, create it:

```sh
bunx wrangler d1 create redlamp-leetcode
```

Then replace the `database_id` value in `wrangler.toml` with the returned ID.

Apply the remote migrations. Then upload the account secret:

```sh
bunx wrangler d1 migrations apply redlamp-leetcode --remote
bunx wrangler secret put LEETCODE_ACCOUNTS < .wrangler/leetcode-accounts.json
```

Deploy after the local checks pass:

```sh
bun run deploy
```

The production origin is `redlamp.me`. Notebook reads on `www.redlamp.me` redirect to that origin. Sessions expire after seven days. Login permits approximately ten attempts per source IP per minute at each Cloudflare location.

Check login, logout, a normal draft save, and a 1,000,000-byte lesson upload and display on the deployed Worker. Use the Cloudflare dashboard's Worker CPU and D1 usage measurements. Confirm that these requests fit the Free limit of 10 ms CPU per invocation. Local timing does not establish edge CPU usage.

## Credential rotation

Run the account-generation command again with the intended usernames. Save the new passwords. Then upload the new `LEETCODE_ACCOUNTS` secret. The command generates new credentials for both accounts. Changing an account's username or password digest invalidates its existing sessions. For local development, replace the account-secret value in `.dev.vars`. Then restart Wrangler.

## Database export and recovery

Export before a migration that can remove data. Keep the export private and outside `public/` and `dist/`:

```sh
umask 077
bunx wrangler d1 export redlamp-leetcode --remote --output .wrangler/redlamp-leetcode-backup.sql
```

D1 Free provides seven days of recovery history. To inspect a recovery point, use a selected timestamp with its UTC offset:

```sh
bunx wrangler d1 time-travel info redlamp-leetcode
bunx wrangler d1 time-travel info redlamp-leetcode --timestamp "2026-10-07T10:00:00+00:00"
```

Select the intended point. Check it before you restore the database. Restore replaces the whole database, including session records. Later notebook changes are removed. Set `BOOKMARK` to the selected value from the command output. Then run this command:

```sh
bunx wrangler d1 time-travel restore redlamp-leetcode --bookmark "$BOOKMARK"
```

Keep the previous bookmark from the restore output if you need to undo the restore. Rotate both accounts after recovery to invalidate sessions from the restored database. See [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) for the recovery procedure.

## Checks

Browser tests run a local Worker and D1 with fixed test credentials. They do not use production data.

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun run lint
bun run typecheck
bun run build
bun run test:browser
bun run test
bunx wrangler deploy --dry-run --outdir .wrangler/leetcode-dry-run
```

Browser reports and screenshots are in `.wrangler/playwright/`. The dry run writes its output to `.wrangler/leetcode-dry-run/`. Generic JavaScript and CSS assets are public. The Worker checks access before serving notebook data, lessons, or the application shell.
