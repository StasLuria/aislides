import { getDb } from '../server/db';
import { presentations } from '../drizzle/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB connection"); process.exit(1); }
  
  const rows = await db.select().from(presentations).orderBy(desc(presentations.createdAt)).limit(10);
  
  for (const r of rows) {
    console.log(`\n=== ${r.id} | ${r.status} | ${r.title?.substring(0, 60)} ===`);
    
    if (r.finalHtmlSlides && typeof r.finalHtmlSlides === 'object') {
      const slides = r.finalHtmlSlides as Record<string, any>;
      for (const [key, slide] of Object.entries(slides)) {
        if (slide.layoutId === 'card-grid') {
          console.log(`\n  Slide ${key}: card-grid`);
          console.log(`  Title: ${slide.data?.title}`);
          console.log(`  Cards count: ${slide.data?.cards?.length}`);
          if (slide.data?.cards) {
            for (const [i, card] of slide.data.cards.entries()) {
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
