import { test, expect } from '@playwright/test';

test.describe('add node', () => {
  test('right-click → Add Node submenu → Value creates a new node', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('vibe:graph'); } catch (e) {}
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

    const before = await page.evaluate(() => window.__editor.graph._nodes.length);

    // Right-click somewhere on the canvas to open the context menu
    const canvas = page.locator('#graph-canvas');
    const box = await canvas.boundingBox();
    const cx = Math.round(box.x + box.width * 0.7);
    const cy = Math.round(box.y + box.height * 0.7);
    await page.mouse.move(cx, cy);
    await page.mouse.click(cx, cy, { button: 'right' });

    // LiteGraph renders menus as .litecontextmenu — open "Add Node" submenu
    const addNode = page.locator('.litecontextmenu .litemenu-entry', { hasText: 'Add Node' }).first();
    await expect(addNode).toBeVisible({ timeout: 4000 });
    await addNode.click();

    // The submenu opens as a separate .litecontextmenu container; find the new one
    const valueOption = page
      .locator('.litecontextmenu .litemenu-entry')
      .filter({ hasText: /^Value$/ })
      .first();
    await expect(valueOption).toBeVisible({ timeout: 4000 });
    await valueOption.click();

    await page.waitForFunction(
      (n) => window.__editor.graph._nodes.length === n + 1,
      before,
      { timeout: 4000 }
    );

    const after = await page.evaluate(() => {
      const last = window.__editor.graph._nodes[window.__editor.graph._nodes.length - 1];
      return { count: window.__editor.graph._nodes.length, type: last.type };
    });

    expect(after.count).toBe(before + 1);
    expect(after.type).toBe('vibe/value');
  });
});
