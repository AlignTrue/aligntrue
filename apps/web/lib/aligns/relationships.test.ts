import { describe, expect, it } from "vitest";

import {
  addRuleToPack,
  getPacksForRule,
  getRulesForPack,
  removeRuleFromPack,
} from "./relationships";

describe("relationships", () => {
  it("tracks bidirectional membership locally when KV is unavailable", async () => {
    const packId = "pack-1";
    const ruleId = "rule-1";

    await addRuleToPack(ruleId, packId);

    const rules = await getRulesForPack(packId);
    const packs = await getPacksForRule(ruleId);

    expect(rules).toContain(ruleId);
    expect(packs).toContain(packId);

    await removeRuleFromPack(ruleId, packId);

    const rulesAfterRemove = await getRulesForPack(packId);
    const packsAfterRemove = await getPacksForRule(ruleId);

    expect(rulesAfterRemove).not.toContain(ruleId);
    expect(packsAfterRemove).not.toContain(packId);
  });
});
