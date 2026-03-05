import { expect, test } from "@playwright/test";
import { addTablesFromSidebar, openBlankEditor } from "./helpers/editor";

test("MYPRIMETYPE is available in the field type selector", async ({ page }) => {
  await openBlankEditor(page);
  await addTablesFromSidebar(page, 1);

  const firstTableInSidebar = page.locator('[id^="scroll_table_"]').first();
  await firstTableInSidebar.click();

  const typeSelect = firstTableInSidebar.locator(".semi-select").first();
  await typeSelect.click();

  await expect(page.getByText("MYPRIMETYPE", { exact: true })).toBeVisible();
});
