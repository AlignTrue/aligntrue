import { parseEntityRef } from "@aligntrue/core";
import {
  ghRepoRef,
  ghPrRef,
  ghIssueRef,
  ghCommitRef,
  ghFileRef,
  ghWorkflowRef,
  ghActorRef,
} from "../src/entity-refs.js";

describe("github entity refs", () => {
  it("builds and parses repo/pr/issue/commit/file/workflow/actor refs", () => {
    const repo = ghRepoRef("owner", "repo");
    const pr = ghPrRef("owner", "repo", 42);
    const issue = ghIssueRef("owner", "repo", 7);
    const commit = ghCommitRef("owner", "repo", "abcdef");
    const file = ghFileRef("owner", "repo", "src/index.ts", "main");
    const wf = ghWorkflowRef("owner", "repo", 1234);
    const actor = ghActorRef("alice");

    for (const ref of [repo, pr, issue, commit, file, wf, actor]) {
      const parsed = parseEntityRef(ref);
      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBeTruthy();
    }
  });
});
