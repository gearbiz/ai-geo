# CURSOR DEVELOPMENT WORKFLOW

## 1. THE LOOP

Do not ask Cursor to "build feature X". Use this loop:

**STEP A: The Spec**

> "Read docs/PRD.md. I need to build [Feature Name].
> Create a test file `app/services/[name].test.ts`.
> Mock dependencies. Assert that [Logic Condition] returns [Expected Result]."

**STEP B: The Red**

> Run `npm test`. Confirm it fails.

**STEP C: The Green**

> "Implement `app/services/[name].server.ts` to pass the test."

**STEP D: The Sanity**

> "Create a script `scripts/verify-[name].ts` to run this with a dummy input and log the output."

## 2. QA GATES (Before merging)

- [ ] **Syntax:** `npm test` passes.
- [ ] **Reality:** Run Google Rich Results Test on the Dev Store.
- [ ] **Context:** Update `@productContext.md` with new status.
