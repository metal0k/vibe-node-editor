import { test, expect } from '@playwright/test';

/**
 * Reads all text colors and effective backgrounds, computes WCAG contrast,
 * and asserts every visible text passes AA (4.5 for normal, 3.0 for UI/large).
 *
 * Runs for both themes. Inspector is exercised with both empty state and
 * one node selected so every code path renders.
 */

const THEMES = ['dark', 'light'];

// WCAG AA thresholds
const T_NORMAL = 4.5;   // body text
const T_LARGE = 3.0;    // UI controls, large text (>=18px regular / 14px bold)

for (const theme of THEMES) {
  test.describe(`contrast — ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.removeItem('vibe:graph');
          localStorage.setItem('vibe:theme', t);
        } catch (e) {}
      }, theme);
    });

    test('DOM text passes WCAG AA', async ({ page }) => {
      await page.goto('./');
      await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

      // Select Value A to populate Inspector with all field types
      await page.evaluate(() => {
        const ed = window.__editor;
        const valueA = ed.graph._nodes.find((n) => n.title === 'Value A');
        if (valueA && ed.lcanvas.selectNode) ed.lcanvas.selectNode(valueA, false);
      });
      await page.waitForFunction(
        () => document.querySelectorAll('#inspector-body .inspector__field').length > 0
      );

      // Walk every visible text-bearing node, compute contrast ratio
      const findings = await page.evaluate(({ T_NORMAL, T_LARGE }) => {
        function parseColor(s) {
          const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s]+([\d.]+))?\)/);
          if (!m) return null;
          return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
        }
        function srgbToLinear(c) {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }
        function luminance({ r, g, b }) {
          return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
        }
        function contrast(a, b) {
          const La = luminance(a), Lb = luminance(b);
          const L1 = Math.max(La, Lb), L2 = Math.min(La, Lb);
          return (L1 + 0.05) / (L2 + 0.05);
        }
        function blend(over, under) {
          // alpha-composite over solid under
          const a = over.a;
          return {
            r: over.r * a + under.r * (1 - a),
            g: over.g * a + under.g * (1 - a),
            b: over.b * a + under.b * (1 - a),
            a: 1,
          };
        }
        function effectiveBg(el) {
          let cur = el;
          let bg = null;
          while (cur && cur.nodeType === 1) {
            const cs = getComputedStyle(cur);
            const c = parseColor(cs.backgroundColor);
            if (c && c.a > 0) {
              bg = bg ? blend(bg, c) : c;
              if (bg.a >= 0.999) break;
            }
            cur = cur.parentElement;
          }
          if (!bg || bg.a < 0.999) {
            // fallback to html bg
            const c = parseColor(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
            bg = bg ? blend(bg, c) : c;
          }
          return bg;
        }
        function isVisible(el) {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
          return true;
        }
        function fontIsLarge(cs) {
          const fs = parseFloat(cs.fontSize);
          const w = +cs.fontWeight;
          return fs >= 18 || (fs >= 14 && w >= 700);
        }

        const results = [];
        const all = document.querySelectorAll('body *');
        for (const el of all) {
          // Skip non-text containers
          let txt = '';
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) txt += n.textContent.trim();
          }
          if (!txt) continue;
          if (!isVisible(el)) continue;
          const cs = getComputedStyle(el);
          const fg = parseColor(cs.color);
          if (!fg) continue;
          const bg = effectiveBg(el);
          // composite fg over bg if fg has alpha
          const fgOnBg = fg.a >= 0.999 ? fg : blend(fg, bg);
          const ratio = contrast(fgOnBg, bg);
          const threshold = fontIsLarge(cs) ? T_LARGE : T_NORMAL;
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string' ? el.className : '';
          results.push({
            text: txt.slice(0, 40),
            tag, cls,
            fg: cs.color,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
            ratio: +ratio.toFixed(2),
            threshold,
            pass: ratio >= threshold,
            fontSize: cs.fontSize,
          });
        }
        return results;
      }, { T_NORMAL, T_LARGE });

      const failures = findings.filter((f) => !f.pass);
      if (failures.length) {
        console.log('\n=== DOM contrast failures ===');
        for (const f of failures) {
          console.log(
            `  [${f.ratio} < ${f.threshold}] <${f.tag}.${f.cls}> "${f.text}"` +
            `  fg=${f.fg}  bg=${f.bg}  ${f.fontSize}`
          );
        }
      }
      expect(failures, `${failures.length} DOM text elements fail WCAG AA contrast in ${theme} theme`).toEqual([]);
    });

    test('canvas-rendered text colors pass WCAG AA', async ({ page }) => {
      await page.goto('./');
      await page.waitForFunction(() => window.__editor?.graph?._nodes?.length > 0);

      const report = await page.evaluate(({ T_NORMAL, T_LARGE }) => {
        function hexOrRgbToRgb(s) {
          s = s.trim();
          if (s.startsWith('#')) {
            const h = s.slice(1);
            const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
            return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: 1 };
          }
          const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s]+([\d.]+))?\)/);
          if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
          return null;
        }
        function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        function luminance({ r, g, b }) { return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
        function contrast(a, b) { const La = luminance(a), Lb = luminance(b); const L1 = Math.max(La, Lb), L2 = Math.min(La, Lb); return (L1 + 0.05) / (L2 + 0.05); }
        function blend(over, under) { const a = over.a; return { r: over.r * a + under.r * (1 - a), g: over.g * a + under.g * (1 - a), b: over.b * a + under.b * (1 - a), a: 1 }; }

        const css = getComputedStyle(document.documentElement);
        const v = (n) => css.getPropertyValue(n).trim();

        const checks = [];

        // Helper to add a check
        const add = (label, fg, bg, threshold = 4.5) => {
          const fgC = hexOrRgbToRgb(fg);
          const bgC = hexOrRgbToRgb(bg);
          if (!fgC || !bgC) { checks.push({ label, ratio: 0, threshold, pass: false, error: `parse: fg=${fg} bg=${bg}` }); return; }
          const fgOnBg = fgC.a >= 0.999 ? fgC : blend(fgC, bgC);
          const ratio = contrast(fgOnBg, bgC);
          checks.push({ label, fg, bg, ratio: +ratio.toFixed(2), threshold, pass: ratio >= threshold });
        };

        const LG = window.__editor.LiteGraph;
        const bodyBg = v('--bg-elevated');

        // 1. Node title text on each header color
        add('node title on Value header',    LG.NODE_TITLE_TEXT_COLOR, v('--node-value'),    T_LARGE);
        add('node title on Multiply header', LG.NODE_TITLE_TEXT_COLOR, v('--node-multiply'), T_LARGE);
        add('node title on Default header',  LG.NODE_TITLE_TEXT_COLOR, v('--node-default'),  T_LARGE);

        // 2. Port label / node body text on body bg
        add('port label / node text on body', LG.NODE_TEXT_COLOR, bodyBg, T_NORMAL);

        // 3. Widget text on widget bg
        add('widget text on widget bg', LG.WIDGET_TEXT_COLOR, LG.WIDGET_BGCOLOR, T_NORMAL);
        add('widget secondary text on widget bg', LG.WIDGET_SECONDARY_TEXT_COLOR, LG.WIDGET_BGCOLOR, T_LARGE);

        // 4. Multiply/Default badge on body bg (theme-aware via --canvas-badge-text)
        add('result badge on body', v('--canvas-badge-text'), bodyBg, T_LARGE);

        // 5. Comment title + body (theme-aware via --canvas-comment-*)
        const commentBg = v('--node-comment-bg');
        add('comment title on bg', v('--canvas-comment-title'), commentBg, T_LARGE);
        add('comment body on bg', v('--canvas-comment-body'), commentBg, T_NORMAL);

        // 6. Selected-node outline ring against canvas bg
        add('selected-node outline on canvas', LG.NODE_BOX_OUTLINE_COLOR, v('--bg-canvas'), T_LARGE);

        // 7. Canvas status badge "Live" — text-muted on bg-overlay over bg-canvas
        const overlayBg = v('--bg-overlay'); // rgba — needs canvas composite
        const canvasBg = v('--bg-canvas');
        // approximate composite of overlay over canvas
        const ov = hexOrRgbToRgb(overlayBg); const cv = hexOrRgbToRgb(canvasBg);
        const eff = ov && cv ? `rgba(${Math.round(blend(ov, cv).r)}, ${Math.round(blend(ov, cv).g)}, ${Math.round(blend(ov, cv).b)}, 1)` : canvasBg;
        add('status badge text on overlay', v('--text-muted'), eff, T_LARGE);

        return checks;
      }, { T_NORMAL, T_LARGE });

      const failures = report.filter((c) => !c.pass);
      if (failures.length) {
        console.log('\n=== Canvas contrast failures ===');
        for (const f of failures) {
          console.log(`  [${f.ratio} < ${f.threshold}] ${f.label}  fg=${f.fg}  bg=${f.bg}`);
        }
      }
      // For visibility, also dump all checks
      console.log(`\n=== Canvas contrast report (${theme}) ===`);
      for (const c of report) {
        console.log(`  ${c.pass ? 'OK ' : 'FAIL'}  ${c.ratio.toString().padStart(5)} ≥ ${c.threshold}   ${c.label}`);
      }
      expect(failures, `${failures.length} canvas text colors fail WCAG AA in ${theme} theme`).toEqual([]);
    });
  });
}
