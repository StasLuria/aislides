import { db } from '../server/db.js';
import { presentations } from '../drizzle/schema.js';
import { desc } from 'drizzle-orm';

async function main() {
  const rows = await db.select().from(presentations).orderBy(desc(presentations.createdAt)).limit(10);
  
  for (const r of rows) {
    console.log(`\n=== ${r.id} | ${r.status} | ${r.title?.substring(0, 60)} ===`);
    
    if (r.finalHtmlSlides && typeof r.finalHtmlSlides === 'object') {
      const slides = r.finalHtmlSlides;
      for (const [key, slide] of Object.entries(slides)) {
        const s = slide;
        if (s.layoutId === 'card-grid') {
          console.log(`\n  Slide ${key}: card-grid`);
          console.log(`  Title: ${s.data?.title}`);
          console.log(`  Cards count: ${s.data?.cards?.length}`);
          if (s.data?.cards) {
            for (const [i, card] of s.data.cards.entries()) {
              console.log(`    Card ${i}: title="${card.title || '<EMPTY>'}" desc="${(card.description || '<EMPTY>').substring(0, 80)}" badge="${card.badge || ''}" icon=${JSON.stringify(card.icon?.name || card.icon || '<none>')}`);
            }
          }
        }
      }
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
