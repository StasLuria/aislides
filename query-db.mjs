import { getDb } from './server/db.ts';
import { presentations } from './drizzle/schema.ts';
import { desc, like } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('No DB connection'); process.exit(1); }
  
  const presos = await db.select({ 
    id: presentations.id, 
    title: presentations.title,
    pipelineState: presentations.pipelineState,
    finalHtmlSlides: presentations.finalHtmlSlides,
  }).from(presentations).orderBy(desc(presentations.createdAt)).limit(5);
  
  console.log('Recent presentations:');
  for (const p of presos) {
    console.log(p.id, '|', p.title);
  }

  // Find the one with 'Стратегия' in title
  const strat = presos.find(p => p.title?.includes('Стратегия') || p.title?.includes('стратегия'));
  if (strat) {
    console.log('\n=== Found:', strat.title, '===');
    
    // Check pipeline state for layout decisions
    const ps = strat.pipelineState;
    if (ps && typeof ps === 'object') {
      const layouts = ps.layoutDecisions || ps.layouts;
      if (layouts) {
        console.log('\nLayout decisions:');
        if (Array.isArray(layouts)) {
          layouts.forEach((l, i) => console.log(`  Slide ${i+1}: ${l.layoutId || l.layout || JSON.stringify(l)}`));
        } else {
          console.log(JSON.stringify(layouts, null, 2).substring(0, 1000));
        }
      }
    }
    
    // Check finalHtmlSlides
    const htmlSlides = strat.finalHtmlSlides;
    if (htmlSlides && Array.isArray(htmlSlides)) {
      console.log('\nTotal slides:', htmlSlides.length);
      
      // Find slide 6 (index 5)
      const slide6 = htmlSlides[5];
      if (slide6) {
        const html = typeof slide6 === 'string' ? slide6 : (slide6.html || JSON.stringify(slide6));
        console.log('\n=== Slide 6 ===');
        console.log('Type:', typeof slide6);
        if (typeof slide6 === 'object') {
          console.log('Keys:', Object.keys(slide6));
          console.log('Layout:', slide6.layoutId || slide6.layout);
        }
        
        const htmlStr = typeof html === 'string' ? html : '';
        const hasGrid = htmlStr.includes('grid-template-columns');
        const bulletRows = (htmlStr.match(/bullet-row/g) || []).length;
        const cardCount = (htmlStr.match(/class="card"/g) || []).length;
        console.log('Has grid:', hasGrid);
        console.log('Bullet-row count:', bulletRows);
        console.log('Card class count:', cardCount);
        console.log('\n--- HTML (first 3000 chars) ---');
        console.log(htmlStr.substring(0, 3000));
      }
    }
  } else {
    console.log('\nNo presentation with "Стратегия" found');
    // Show pipeline state of the latest one
    const latest = presos[0];
    if (latest?.finalHtmlSlides && Array.isArray(latest.finalHtmlSlides)) {
      console.log('\nLatest has', latest.finalHtmlSlides.length, 'slides');
      const slide6 = latest.finalHtmlSlides[5];
      if (slide6) {
        const html = typeof slide6 === 'string' ? slide6 : (slide6.html || '');
        console.log('Slide 6 HTML (first 2000):', html.substring(0, 2000));
      }
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
