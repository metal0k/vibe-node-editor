import { test, expect } from '@playwright/test';

test.describe('connect ports', () => {
  test('drag from one Value output to a fresh Multiply input creates a link', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('vibe:graph'); } catch (e) {}
    });
    await page.goto('./');
    await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

    // Add a fresh, isolated Multiply node positioned away from other nodes,
    // then connect Value A's output to its first input.
    const setup = await page.evaluate(() => {
      const ed = window.__editor;
      const valueA = ed.graph._nodes.find((n) => n.title === 'Value A');
      const mult = ed.LiteGraph.createNode('vibe/multiply');
      mult.pos = [valueA.pos[0] + 360, valueA.pos[1] - 20];
      ed.graph.add(mult);
      return { valueAId: valueA.id, multId: mult.id, linksBefore: Object.keys(ed.graph.links || {}).length };
    });

    // Compute exact screen-space positions for Value A output slot 0
    // and the new Multiply input slot 0 using LiteGraph's own helper.
    const portCoords = await page.evaluate(({ valueAId, multId }) => {
      const ed = window.__editor;
      const lcanvas = ed.lcanvas;
      const ds = lcanvas.ds;
      const canvasRect = lcanvas.canvas.getBoundingClientRect();

      const valueA = ed.graph._nodes.find((n) => n.id === valueAId);
      const mult = ed.graph._nodes.find((n) => n.id === multId);

      // node.getConnectionPos(is_input, slot) returns absolute graph coords
      const outGraph = valueA.getConnectionPos(false, 0);
      const inGraph = mult.getConnectionPos(true, 0);

      const fromGraph = (gx, gy) => {
        const sx = (gx + ds.offset[0]) * ds.scale;
        const sy = (gy + ds.offset[1]) * ds.scale;
        return { x: canvasRect.left + sx, y: canvasRect.top + sy };
      };

      return {
        out: fromGraph(outGraph[0], outGraph[1]),
        in: fromGraph(inGraph[0], inGraph[1]),
      };
    }, setup);

    // Drag from output port to input port
    await page.mouse.move(portCoords.out.x, portCoords.out.y);
    await page.mouse.down();
    await page.mouse.move(portCoords.in.x, portCoords.in.y, { steps: 12 });
    await page.mouse.up();

    // Verify a new link exists targeting the new Multiply input 0
    await page.waitForFunction(
      ({ multId, before }) => {
        const links = Object.values(window.__editor.graph.links || {});
        const hits = links.filter((l) => l && l.target_id === multId && l.target_slot === 0);
        return hits.length >= 1 && links.length > before;
      },
      { multId: setup.multId, before: setup.linksBefore },
      { timeout: 4000 }
    );

    const verdict = await page.evaluate(({ multId }) => {
      const links = Object.values(window.__editor.graph.links || {});
      return links.some((l) => l && l.target_id === multId && l.target_slot === 0);
    }, setup);

    expect(verdict).toBe(true);
  });
});
