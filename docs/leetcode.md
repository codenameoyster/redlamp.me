# LeetCode notebook

The private notebook at `https://redlamp.me/leetcode` supports one parent and one student. Use LeetCode for code runs and submissions. Use this notebook for explanations, saved attempts, homework, feedback, learning sets, and review reminders.

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
- As the student, start a draft. A draft can hold one or more approaches. The editor autosaves changed content. On a Бомжарня task, use **Отправить**: the server checks the code on hidden tests and accepts the attempt when all tests pass. On another problem, use **Решено** to save the attempt as accepted.
- The understanding of an accepted attempt is automatic: "independent" when the student did not write to the tutor about the problem, else "with help". Both roles can use **Нужно потренироваться**. It sets the understanding "needs practice" and a random review date from 15 to 45 days after today.
- Below **Solution code** of a Python approach, the notebook checks the student's draft code while he types. Ruff and the Python compiler report the problems with their line numbers. **Run tests** runs the code in the browser with Pyodide against the tests of the problem. Each test has 2 seconds. The code is not sent to LeetCode or Codeforces.
- In the code editor, a list of names opens while the student types. It shows the Python keywords, the built-in names, the names that a solution can use without an import, such as `heapq` and `List`, and the names of the code. After a dot, for example `heapq.` or `q.`, [jedi](https://jedi.readthedocs.io/) in the Pyodide worker gives the members. The browser loads jedi on the first completion after a dot. Tab or Enter inserts the selected name. Enter after a name that is typed in full adds a new line. Escape closes the list, and Ctrl+Space opens it. Ctrl+Space without a dot shows the names without jedi.
- Both roles can add up to 20 own tests to a problem in **My tests**. An own test has only the input. **Run tests** runs them after the standard tests.
- A task of a learning set has a reference solution on the server. The reference solution gives the correct answer of each own test. The result of a test shows the correct answer and the answer of the student. The result is green when the two answers are the same and red when they are different. An input outside the constraints of the task gets a note and no check. A problem outside the sets has no reference solution, so its own tests show only the answer of the student.
- A task of a learning set has its standard tests in the set. For another LeetCode problem, the standard tests are the examples of the statement from LeetCode. A problem with a `TreeNode`, a `ListNode` or a class to design has no runner. A Codeforces problem outside the sets has only own tests.
- The notebook records each test run of the student. An approach shows **Tests passed** when its latest run passed all tests and its code did not change after that run. The attempt history shows the same mark for the attempt.
- As the parent, create homework on the **Homework** page. Give it a title, instructions, and an optional due date. Use **Edit homework** to change these details later. Use **Изменить срок** next to the due date to change only the date. A new due date lets the student use **Сила Бомжа** again.
- On the homework page, use **Add a task** to add a problem from the library. Each task has its own review state. A problem can have only one active task in all homework.
- The **Homework** page shows the tasks of all homework in three sections. **В процессе** has the started, submitted, and returned tasks. **Будущее** has the assigned tasks. **Принятое** has the completed tasks, with the newest first. The page does not show cancelled tasks.
- In **Принятое**, use **Распределить повторения на 30 дней**. Each problem of a completed task gets a random review date from tomorrow to 30 days after today. Two problems get the same date only when there are more than 30 problems. A problem with a review date in this period keeps its date. On the review date, **Today** shows the problem in **Пора повторить**. The link opens the recall page of a pick, so the student solves the problem again without the saved work.
- The parent can link learning sets to problems and homework in **Materials**. **Materials** also shows the set chapters that contain the problem. For homework, it shows the chapters of all its problems. A task page shows the chapters of its problem and the sets of its homework.
- As the student, open a task from **Today**, the homework page, or the problem page. **Решено** submits the attempt for review. The parent can request another attempt or complete the task. An attempt that passes the hidden tests completes the task. The parent can still return a completed task.
- A red dot before a homework or a task shows a message or a review decision from the other account that you did not read. Open the discussion of the task or the problem to remove the dot.
- Use **Recall this problem** to practise before revealing saved work. Record the result. Choose the next review date.
- **Today** also shows random recall picks from the library: three problems of the Two Pointers set and two problems of the first permutations homework. The picks change every day. A pick that you recall today leaves the list. The recall page of a pick does not show the summary or the saved work. Use **Start a new attempt** to solve the problem again. If the problem has a draft, the button opens the draft.
- **Archive problem** moves a problem to **Archived problems** in the library and blocks new homework tasks for it. **Restore problem** returns it.
- As the student, use **Голосовой ввод** (the microphone button) to dictate Russian text into a notes field, the review note, the tutor message, or the problem description. Select the button again to stop. A recording stops after 2 minutes. The notebook puts the text at the cursor, or at the end when you did not select a position in the field. The Worker sends the audio to Whisper on Cloudflare Workers AI and does not keep it.
- If a save fails, keep the page open. Use **Retry save** or **Copy unsaved work**. Reload recovery is available in the same tab when browser session storage works. Conflicting edits require an explicit choice of the server copy.

## Learning sets

A learning set is a sequence of chapters about one subject. Each chapter has a lesson, a list of problems and a deck of quiz cards. The sets are content in the repository. A deployment publishes them. The **Бомжарня** page lists the sets. It is read-only for both roles.

A set page shows the reading links and the chapters. A chapter row shows the accepted problem count and the quiz status. A chapter page shows the chapter lesson, the problems, the quiz status and a link to the chapter quiz. A lesson can show figures. A figure with more than one step shows **Назад** and **Вперёд**. A hard word, for example "инвариант", has a dotted line at its first use in a lesson, a statement, a summary or a quiz card. Its tip shows on hover, on keyboard focus and after a tap. A problem row shows **Accepted** when the library problem has an accepted saved attempt. A problem row with an active homework task shows the task state. The state links to the task.

As the parent, use **Add to homework** on a problem row. The dialog shows the active homework. Use the search box to find homework by title. Use **Assign** to add the problem to that homework. Use **Create and assign** to create new homework with the problem in one step. The notebook adds the problem to the library when the library does not have it. A problem with an active task has no **Add to homework** button.

For the student, a chapter page shows **Explain with AI** below the text that is selected in the lesson. Ctrl+Enter or Cmd+Enter does the same. The AI tutor then explains the selected text. When an answer quotes the lesson, **Show in the lesson** marks the passage. The parent does not see these controls.

The parent can also link a set to a problem or to homework. Choose the set in **Materials**. The link opens the set page.

The **Квиз** page shows one deck for each chapter. An attempt answers all cards of one deck. The page sends the answers to the server after the last card. If the student leaves before the last card, the notebook keeps no answers. An attempt passes with 80 % or more correct answers: 8 cards need 7, 7 cards need 6, 6 cards need 5. After a passed attempt, the page shows each card with the answer of the student, the right answer and the explanation. After a failed attempt, the page shows only the cards with a wrong answer, without the right answers. After each attempt, passed or failed, the notebook closes the deck for 1 hour. The quiz status is **Пройден** with the best passed result, or **Не пройден**, and the time of the next attempt during the pause. The parent sees all cards of a deck with the answers.

To add a set:

1. Create the folder `src/leetcode/sets/<slug>/`. Use lowercase letters, digits, and dashes in the slug.
2. Write `chapter<N>.ts` for each chapter. Export the chapter data as the default export. Type it with `satisfies Chapter`. Give the chapter a title, a summary, its tasks and its cards. Put the lesson pictures in `figures`, see step 3. For each task, use the problem slug from its LeetCode URL.
3. Write `chapter<N>.html` for each chapter as an HTML fragment. The chapter page inserts it without changes. Start with `<p class="lead">` and one sentence. Then write sections that start with `<h2 id="sN">`. Use only these elements: `h2 h3 p ul ol li table caption thead tbody tr th td pre code strong em sup blockquote details summary a br figure`, and `<div class="rule">` for a rule. Put a picture as `<figure data-figure="<id>"></figure>` on its own line. Describe it in `figures` of `chapter<N>.ts` in the same order. A figure has an id, a Russian title and one or more frames. A frame has a Russian caption and rows of cells. A row can have a label, marked cells, dimmed cells, pointers under the cells and a window bracket. A row with `tree: true` draws its cells as a binary tree in `heapq` order: the children of place i are places 2i + 1 and 2i + 2. An empty string is an empty place. A tree row has no pointers and no window. A marked cell is a cell that the step works on. A dimmed cell holds a value that a move removed. Do not show a pointer that is past the end of its row. Say in the caption where that pointer is. Make each frame from a trace of the algorithm on the numbers of the picture. Do not use scripts, styles, `style` attributes or event attributes. Write code blocks as `<pre><code class="language-python">`. Write a hint as `<details><summary>Подсказка 1</summary>...</details>`. Give external links `target="_blank" rel="noopener noreferrer"`.
4. Write `set.ts`. Export the set data as the default export. Type it with `satisfies LearningSet`. Import the chapters into `chapters` in reading order. Add a new chapter only after the last chapter of a published set, and do not change the slug of a published set. The quiz attempts keep the deck as `<set slug>-<chapter number>`.
5. Write `solutions.ts` with a reference solution for each task. Export an object with the task slugs as keys as the default export. Type it with `satisfies Record<string, Reference>`. A reference has the mode of the task tests. A `call` reference returns the value that the tests compare. A `stdio` reference returns the standard output. Check the constraints of the statement first with the functions in `src/leetcode/sets/constraints.ts`. Lint stops an import from `src/` in `web/`, so the reference solutions do not get to the browser.
6. In `src/leetcode/sets/index.ts`, import the set, its chapter lessons and its reference solutions. Add the set to `sets` with `lessons: [...]` in chapter order. The order of `sets` is the display order. Add the reference solutions to `references`.
7. Find the hard words in the student text: the summaries, the lessons, the statements, the notes and the cards. For each hard word that `shared/glossary.ts` does not have, add an entry. Give the entry a pattern for the word and its forms. Give it a plain Russian tip of one or two short sentences. Add the start of the word to `hardWord` in `test/sets.test.ts`. Do not add a word that has two meanings in the sets. Name the data structures in English in the Russian text: heap, queue, deque, stack, priority queue, monotonic deque. For example, write "В heap наименьший элемент лежит в h[0]". Use "очередь" only for a real line of people.
8. Run `bun run test`. `test/sets.test.ts` checks each set: unique set and task slugs, the slug format, a title, a summary and at least one task for each chapter, https links, one lesson for each chapter, the lesson size and format, the figure placeholders, ids and indexes, the card ids, options and answers, a tip for each hard word, no "куча", "дек" or "стек" in the set text, and that the reference solution of each task passes the standard tests of the task.

## AI tutor

The AI tutor uses the parent's ChatGPT plan through Sign in with ChatGPT. The plan must be ChatGPT Plus or Pro. The Worker keeps the ChatGPT tokens in D1. It encrypts them with AES-GCM and the key in the `TUTOR_TOKEN_KEY` secret. The tokens never go to the browser.

OpenAI permits plan usage for open-source and locally hosted apps. For a remotely hosted app, OpenAI asks for the [interest form](https://openai.com/form/sign-in-with-chatgpt-interest/). A Worker is a remotely hosted app. The student also uses the plan of the parent. The parent decides if these conditions are acceptable.

Create the key and upload it:

```sh
openssl rand -base64 32 | bunx wrangler secret put TUTOR_TOKEN_KEY
```

For local development, add `TUTOR_TOKEN_KEY=<value>` to `.dev.vars`. Use a value from `openssl rand -base64 32`. A missing key or a key that is not 32 bytes stops the tutor with "The AI tutor needs configuration."

Apply the remote migrations and upload the secret before you deploy. A version gets only the secrets that exist when you upload it. `preview_urls = false` in `wrangler.toml` turns off the Version URLs, because a Version URL serves an old version with its old code and the production database.

To connect ChatGPT:

1. As the parent, open **AI tutor** and select **Continue with ChatGPT**.
2. Open the ChatGPT sign-in page and approve access. The browser then shows an error page for `127.0.0.1`. This is expected.
3. Copy the full address from that page. Paste it in **Address from the error page** and select **Connect**. Do this at once: the sign-in expires after 10 minutes, and the code in the address is valid for a short time.

After the connection, select the model in **Model**. The list contains the models of the plan. A new connection reads the list again. It keeps the selected model when the new list contains it.

The tutor gives hints. It does not write the solution, also when the student asks for it. For a new question about how to solve a problem, it asks one guiding question. When the student asks for more help, it names the idea, then gives the key step on a small example, and then names the parts of the function. When the student asks it to check the code, it tells about one bug in each answer and gives a small input that shows the bug. It does not write the corrected code. The rules are in `src/leetcode/tutor-prompt.txt`.

Each problem and set has one chat. A task page shows the chat of its problem. The student selects **Ask AI** on these pages. On a screen of 1400 px and wider, the chat panel stays open beside the page, also on the next page. On a smaller screen, the panel opens over the page. Ctrl+Enter or Cmd+Enter sends the message. On a chapter page, the student can also select text in the lesson and choose **Explain with AI**. See [Learning sets](#learning-sets).

Only the student can read and use the chats. The parent cannot read them, and the pages of the parent show no tutor. The **AI tutor** page of the parent only manages the ChatGPT connection. The notebook keeps a turn only when the answer is complete. If an answer stops, the student sends the question again.

Each question of the student goes to OpenAI under the ChatGPT account of the parent, with the earlier messages of the chat and the context of the open page. This context can contain the problem, the LeetCode statement, the homework instructions, the notes and code of the student, and the lesson text. For a problem in a set chapter, the context also has the lesson text of the first such chapter. The tutor uses the same plan limits as the parent's own ChatGPT and Codex use. On ChatGPT Plus, all apps share one five-hour limit. Use **Manage usage** to see the usage.

The Worker reads each part of a streamed answer, so the CPU time of a turn increases with the length of the answer. On the deployed Worker, send a question on the page with the largest lesson and get a long answer with a diagram. Make sure that the answer arrives in parts. Then read the CPU time of the request in the Cloudflare dashboard. If long answers exceed the Workers Free limit of 10 ms CPU per request, use Workers Paid.

The connection stays valid while the tutor is in use. After 30 days with no tutor use, the refresh token expires. Then connect again.

**Disconnect** revokes the ChatGPT tokens and removes them from D1. If ChatGPT does not confirm the revocation, remove the app in the ChatGPT settings. OpenAI does not tell the notebook about a removal in the ChatGPT settings.

To rotate the key, select **Disconnect** before you upload a new key, so that ChatGPT revokes the old tokens. Then upload the new `TUTOR_TOKEN_KEY` and connect again. If you changed the key first, the page still shows Connected: select **Disconnect**, and then remove the app in the ChatGPT settings.

## Levels and badges

The notebook uses the Arcade theme. Dark is the default appearance. Use the appearance button in the top bar to change to light and back. The browser keeps the choice.

The top bar shows the level and the progress to the next level. The bar is hidden on screens of 620 px or less. **Today** shows the level, the XP, and the badges.

The notebook calculates XP from saved records. Failed test runs, late homework and missed days decrease the XP. The XP is never less than 0. Archived problems keep their XP. The notebook records a visit day when the student opens a notebook page or moves to another page. A missed day is a UTC day without a visit, from the first visit day to yesterday.

| Source | XP |
|---|---|
| A problem with an accepted saved attempt, one time for each problem | easy 10, medium 20, hard 40 |
| An accepted problem with a saved attempt or a review with the understanding "independent", one time for each problem | 10 |
| A completed homework task | 15 |
| A review, one time for each problem and day | 5 |
| A correct answer in the best passed quiz attempt of each deck | 2 |
| A test run that passed all tests, one time for each problem | 10 |
| A test run with a failed test, at most three runs for each problem and day | -2 |
| A homework task without a submission by its due date | -15 |
| A missed day | -5 |

The correct answers of the earlier quiz, which saved one answer for each card, keep their 2 XP and count for **50 карточек**.

Level L starts at `50 * L * (L - 1)` XP: level 2 at 100 XP, level 3 at 300 XP, level 4 at 600 XP, and level 5 at 1000 XP.

A badge stays earned, except Уровень 5: it shows the current level. The student and the parent see the same badges.

| Badge | Rule |
|---|---|
| First accept | One problem with an accepted saved attempt. |
| 3-day streak | Saved attempts on three consecutive days. The notebook uses UTC dates. |
| First hard | One hard problem with an accepted saved attempt. |
| Ten accepted | Ten problems with an accepted saved attempt. |
| Independent five | Five accepted problems with the understanding "independent". |
| Set cleared | An accepted saved attempt for each problem of one learning set. |
| Неделя без пропусков | Visit days on 7 consecutive days. |
| Месяц без пропусков | Visit days on 30 consecutive days. |
| 25 принятых | 25 problems with an accepted saved attempt. |
| 50 принятых | 50 problems with an accepted saved attempt. |
| 50 карточек | 50 correct answers in the best passed quiz attempts of the decks. |
| Десять повторений | 10 reviews, one for each problem and day. |
| Первая с Codeforces | One Codeforces problem with an accepted saved attempt. |
| С первого раза | The first test run of a problem passed all tests. |
| Два набора | An accepted saved attempt for each problem of two learning sets. |
| Вовремя | 5 homework tasks with a submission by the due date. |
| Уровень 5 | Level 5, which starts at 1000 XP. |

The hidden tests or **Решено** set the acceptance, and the understanding is automatic. The **Today** counts do not include archived problems, so they can be different from the XP.

## Cloudflare setup

Use an account with Workers Free and D1 Free. Check the account's existing usage before deployment. The application uses no R2 storage or paid service. Dictation uses Workers AI. Its free allocation is 10,000 neurons a day, about 214 minutes of dictation with `@cf/openai/whisper-large-v3-turbo` ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)). `bun run dev` also sends dictation to Workers AI. The tests do not.

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

Check login, logout, and a normal draft save on the deployed Worker. Use the Cloudflare dashboard's Worker CPU and D1 usage measurements. Confirm that these requests fit the Free limit of 10 ms CPU per invocation. Local timing does not establish edge CPU usage.

## Releases

The sidebar shows the version from `package.json`. The versions follow [Semantic Versioning](https://semver.org/). The release-please workflow reads the Conventional Commits on `main` and keeps a release PR open. A `feat` commit increases the minor version. A `fix` commit increases the patch version. Merge the release PR to publish the version. The merge updates `package.json` and `CHANGELOG.md`, tags `vX.Y.Z` and publishes a GitHub release. Workers Builds then deploys the new version.

The workflow can open the release PR only when **Allow GitHub Actions to create and approve pull requests** is on in **Settings**, **Actions**, **General**.

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
