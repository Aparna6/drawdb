import { expect, test } from "@playwright/test";
import { addTablesFromSidebar, openBlankEditor } from "./helpers/editor";

test("stats box updates after adding tables", async ({ page }) => {
  await openBlankEditor(page);

  const stats = page.locator("div", { hasText: /^Stats/ }).first();
  await expect(stats).toContainText("Tables0");
  await expect(stats).toContainText("Relationships0");

  await addTablesFromSidebar(page, 2);

  await expect(stats).toContainText("Tables2");
  await expect(stats).toContainText("Relationships0");
  await expect(stats).toContainText("Isolated tables2");
});
