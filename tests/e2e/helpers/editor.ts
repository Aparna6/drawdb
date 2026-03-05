import { expect, Page } from "@playwright/test";

export async function openBlankEditor(page: Page) {
  await page.goto("/editor");
  await page.getByText("Choose a database").waitFor({ state: "visible" });
  await page.getByText("Generic", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Choose a database")).not.toBeVisible();
}

export async function addTablesFromSidebar(page: Page, count: number) {
  const addTable = page.getByRole("button", { name: "Add table" });
  for (let i = 0; i < count; i++) {
    await addTable.click();
  }
}
