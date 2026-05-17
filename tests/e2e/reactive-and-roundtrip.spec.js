import { test, expect } from '@playwright/test';

test.describe('reactive execution + JSON round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('vibe:graph'); } catch (e) {}
    });
  });

  test('changing Value A propagates through Multiply', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

    // Set Value A = 7, force step, then read Multiply result
    const result = await page.evaluate(() => {
      const ed = window.__editor;
      const valueA = ed.graph._nodes.find((n) => n.title === 'Value A');
      const mult = ed.graph._nodes.find((n) => n.title === 'Multiply');
      const valueB = ed.graph._nodes.find((n) => n.title === 'Value B');
      valueA.properties.value = 7;
      if (valueA.widgets?.[0]) valueA.widgets[0].value = 7;
      ed.graph.runStep();
      return {
        a: valueA.properties.value,
        b: valueB.properties.value,
        result: mult._lastResult,
      };
    });

    expect(result.a).toBe(7);
    expect(result.result).toBe(result.a * result.b);
  });

  test('serialize → configure round-trip preserves structure', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

    const diff = await page.evaluate(() => {
      const g = window.__editor.graph;
      const before = JSON.parse(JSON.stringify(g.serialize()));
      // Round-trip
      g.configure(JSON.parse(JSON.stringify(before)));
      const after = JSON.parse(JSON.stringify(g.serialize()));

      // Compare counts and topology
      const summarize = (s) => ({
        nodeCount: (s._nodes || s.nodes || []).length,
        types: (s._nodes || s.nodes || []).map((n) => n.type).sort(),
        linkCount: Array.isArray(s.links) ? s.links.length : Object.keys(s.links || {}).length,
      });
      return { before: summarize(before), after: summarize(after) };
    });

    expect(diff.after.nodeCount).toBe(diff.before.nodeCount);
    expect(diff.after.linkCount).toBe(diff.before.linkCount);
    expect(diff.after.types).toEqual(diff.before.types);
  });

  test('Save JSON triggers a download', async ({ page }) => {
    await page.goto('./');
    await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-save-json').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^vibe-graph-\d{8}-\d{6}\.json$/);
  });
});
