import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('app loads, canvas visible, sample graph present, no console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // Make sure we start without any persisted graph polluting the test
    await page.addInitScript(() => {
      try { localStorage.removeItem('vibe:graph'); } catch (e) {}
    });

    await page.goto('/');

    await expect(page.locator('#graph-canvas')).toBeVisible();
    await expect(page.locator('#topbar')).toBeVisible();
    await expect(page.locator('#inspector')).toBeVisible();

    // Wait for editor to finish bootstrapping
    await page.waitForFunction(() => window.__editor && window.__editor.graph?._nodes?.length > 0);

    const state = await page.evaluate(() => {
      const g = window.__editor.graph;
      return {
        nodeCount: g._nodes.length,
        linkCount: Object.keys(g.links || {}).length,
        types: g._nodes.map((n) => n.type).sort(),
      };
    });

    // Sample graph: 5 functional nodes + 1 comment = 6 nodes, 4 links
    expect(state.nodeCount).toBeGreaterThanOrEqual(5);
    expect(state.linkCount).toBeGreaterThanOrEqual(3);
    expect(state.types).toContain('vibe/value');
    expect(state.types).toContain('vibe/multiply');
    expect(state.types).toContain('vibe/comment');

    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
