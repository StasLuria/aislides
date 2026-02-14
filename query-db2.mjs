import { getDb } from './server/db.ts';
import { presentations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('No DB connection'); process.exit(1); }
  
  // Check presentation 720002 (the "Презентация" one)
  const [preso] = await db.select({ 
    id: presentations.id, 
    title: presentations.title,
    pipelineState: presentations.pipelineState,
    finalHtmlSlides: presentations.finalHtmlSlides,
  }).from(presentations).where(eq(presentations.id, 720002));
  
  if (!preso) { console.log('Not found'); process.exit(1); }
  
  console.log('Presentation:', preso.id, '|', preso.title);
  
  // Check pipeline state for layout decisions
  const ps = preso.pipelineState;
  if (ps && typeof ps === 'object') {
    // Look for layout info
    const outline = ps.outline;
    if (outline && Array.isArray(outline)) {
      console.log('\nOutline:');
      outline.forEach((s, i) => console.log(`  ${i+1}. ${s.title} | layout: ${s.layout || s.layoutId || 'N/A'}`));
    }
    
    const layouts = ps.layoutDecisions;
    if (layouts) {
      console.log('\nLayout decisions:');
      console.log(JSON.stringify(layouts).substring(0, 2000));
    }
  }
  
  const htmlSlides = preso.finalHtmlSlides;
  if (htmlSlides && Array.isArray(htmlSlides)) {
    console.log('\nTotal slides:', htmlSlides.length);
    
    // Find the slide with "стратегия" or "лидерства"
    for (let i = 0; i < htmlSlides.length; i++) {
      const slide = htmlSlides[i];
      const html = typeof slide === 'string' ? slide : (slide?.html || '');
      if (html.includes('лидерства') || html.includes('стратегия') || html.includes('Стратегия')) {
        console.log(`\n=== Slide ${i+1} (contains "стратегия/лидерства") ===`);
        console.log('Has grid:', html.includes('grid-template-columns'));
        console.log('Bullet-row count:', (html.match(/bullet-row/g) || []).length);
        console.log('Card class count:', (html.match(/class="card"/g) || []).length);
        
        // Extract grid-template-columns value
        const gridMatch = html.match(/grid-template-columns:\s*([^;]+)/);
        if (gridMatch) console.log('Grid value:', gridMatch[1]);
        
        console.log('\n--- HTML ---');
        console.log(html.substring(0, 4000));
        break;
      }
    }
    
    // Also show all slides' layouts
    console.log('\n=== All slides summary ===');
    for (let i = 0; i < htmlSlides.length; i++) {
      const slide = htmlSlides[i];
      const html = typeof slide === 'string' ? slide : (slide?.html || '');
      const hasGrid = html.includes('grid-template-columns');
      const bulletRows = (html.match(/bullet-row/g) || []).length;
      const cardCount = (html.match(/class="card"/g) || []).length;
      const titleMatch = html.match(/<h1[^>]*>([^<]+)/);
      const title = titleMatch ? titleMatch[1].substring(0, 60) : '(no title)';
      console.log(`  Slide ${i+1}: grid=${hasGrid} bullets=${bulletRows} cards=${cardCount} | ${title}`);
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
