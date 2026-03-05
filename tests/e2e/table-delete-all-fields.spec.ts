import { expect, test } from "@playwright/test";
import { addTablesFromSidebar, openBlankEditor } from "./helpers/editor";

test("table options can delete all fields", async ({ page }) => {
  await openBlankEditor(page);
  await addTablesFromSidebar(page, 1);

  const tableCard = page.locator("foreignObject").first();
  await tableCard.hover();
  await tableCard.locator("button").nth(2).click();

  await expect(page.getByText("Delete all fields", { exact: true })).toBeVisible();
  await page.getByText("Delete all fields", { exact: true }).click();

  const tableInSidebar = page.locator('[id^="scroll_table_"]').first();
  await tableInSidebar.click();

  await expect(page.locator('[id*="_input_"]')).toHaveCount(0);
});
