import { expect, test } from "@playwright/test";
import { addTablesFromSidebar, openBlankEditor } from "./helpers/editor";

async function getTablePositions(page) {
  const tables = page.locator("foreignObject");
  const count = await tables.count();
  const positions: Array<string> = [];

  for (let i = 0; i < count; i++) {
    const table = tables.nth(i);
    const x = await table.getAttribute("x");
    const y = await table.getAttribute("y");
    positions.push(`${x},${y}`);
  }

  return positions;
}

test("auto arrange spreads overlapping tables", async ({ page }) => {
  await openBlankEditor(page);
  await addTablesFromSidebar(page, 3);

  const before = await getTablePositions(page);
  expect(new Set(before).size).toBe(1);

  await page.getByText("View", { exact: true }).click();
  await page.getByText("Auto arrange", { exact: true }).click();

  await expect.poll(async () => new Set(await getTablePositions(page)).size).toBeGreaterThan(1);

  const after = await getTablePositions(page);
  expect(after).not.toEqual(before);
});
