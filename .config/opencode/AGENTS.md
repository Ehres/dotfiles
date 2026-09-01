<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
<!-- context7 -->

My GitHub username is `Ehres`.

When designing changes or reviewing code, check and apply the project's documented coding rules, guidelines, and standards.

When work is associated with a Linear issue, move it to `In Progress` before starting implementation.

When creating Git worktrees, always place them beside the main repository using `<repo>.worktree/<branch>`. For example, worktrees for `/Users/maxime.grebauval/projects/orus-monorepo` belong under `/Users/maxime.grebauval/projects/orus-monorepo.worktree/`.

Never commit specifications or implementation plans created by Superpowers skills unless the user explicitly requests it.

## Collaboration

- Challenge architectural decisions and ambiguous approaches before implementation.
- Verify plans, assumptions, and external information against the current source of truth before presenting them as fact.
- Surface nearby inconsistencies, risks, and suspicious behavior discovered during work.
- Avoid em dashes in generated prose.
- When speaking French, retain established English technical terms (for example, use `Chip` rather than `puce`) unless a French translation is clearly the industry standard.
When creating a Linear issue, assign it to `Ehres` in the `OMN` team with the `frontend` label and `Improvement` type by default, unless the user explicitly specifies otherwise.

