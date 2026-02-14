import { getDb } from '../server/db';
import { presentations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { renderSlide } from '../server/pipeline/templateEngine';
import * as fs from 'fs';

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }
  
  const rows = await db.select().from(presentations).where(eq(presentations.id, '690001'));
  const r = rows[0];
  if (!r) { console.error("Not found"); process.exit(1); }
  
  const fhs = r.finalHtmlSlides as Record<string, any>;
  const themeCss = (r.themeCss as string) || '';
  
  // Re-render card-grid slides with the updated template
  const slideHtmls: string[] = [];
  const slideKeys = Object.keys(fhs).sort((a, b) => Number(a) - Number(b));
  
  for (const key of slideKeys) {
    const slide = fhs[key];
    const layoutId = slide.layoutId;
    const data = slide.data;
    
    if (layoutId === 'card-grid') {
      console.log(`Re-rendering slide ${key} (${layoutId}) with new template...`);
      const html = renderSlide(layoutId, data);
      slideHtmls.push({ idx: key, html, layoutId } as any);
    } else {
      // Use existing HTML
      slideHtmls.push({ idx: key, html: slide.html, layoutId } as any);
    }
  }
  
  // Build a full HTML page with all slides
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Card Grid Test</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; }
    .slide-container { width: 1280px; height: 720px; position: relative; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .slide-label { color: #fff; font-family: monospace; font-size: 14px; margin-bottom: 4px; }
    ${themeCss}
  </style>
</head>
<body>
  ${(slideHtmls as any[]).map((s: any) => `
    <div class="slide-label">Slide ${s.idx}: ${s.layoutId}</div>
    <div class="slide-container slide">
      ${s.html}
    </div>
  `).join('\n')}
</body>
</html>`;
  
  fs.writeFileSync('/home/ubuntu/card-grid-test.html', fullHtml);
  console.log('Saved to /home/ubuntu/card-grid-test.html');
  
  // Also save just the card-grid slides for focused inspection
  const cardGridOnly = (slideHtmls as any[]).filter((s: any) => s.layoutId === 'card-grid');
  const focusedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Card Grid Fix Test</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; flex-direction: column; align-items: center; gap: 40px; padding: 40px; }
    .slide-container { width: 1280px; height: 720px; position: relative; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .slide-label { color: #fff; font-family: monospace; font-size: 16px; margin-bottom: 8px; }
    ${themeCss}
  </style>
</head>
<body>
  ${cardGridOnly.map((s: any) => `
    <div class="slide-label">Slide ${s.idx}: ${s.layoutId} (FIXED)</div>
    <div class="slide-container slide">
      ${s.html}
    </div>
  `).join('\n')}
</body>
</html>`;
  
  fs.writeFileSync('/home/ubuntu/card-grid-fixed.html', focusedHtml);
  console.log('Saved focused view to /home/ubuntu/card-grid-fixed.html');
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
