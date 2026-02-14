import { getDb } from '../server/db';
import { presentations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }
  
  // The screenshot shows "Нужно ли делать ИИ-бота-агрегатора" - ID 690001
  const rows = await db.select().from(presentations).where(eq(presentations.id, '690001'));
  const r = rows[0];
  if (!r) { console.error("Not found"); process.exit(1); }
  
  console.log(`=== ${r.id} | ${r.title} ===`);
  
  if (r.finalHtmlSlides && typeof r.finalHtmlSlides === 'object') {
    const slides = r.finalHtmlSlides as Record<string, any>;
    for (const [key, slide] of Object.entries(slides)) {
      console.log(`\nSlide ${key}: ${slide.layoutId}`);
      if (slide.layoutId === 'card-grid') {
        console.log(`  Title: ${slide.data?.title}`);
        console.log(`  Description: ${slide.data?.description}`);
        console.log(`  Cards count: ${slide.data?.cards?.length}`);
        if (slide.data?.cards) {
          for (const [i, card] of slide.data.cards.entries()) {
            console.log(`  Card ${i}:`);
            console.log(`    title: "${card.title}"`);
            console.log(`    description: "${card.description}"`);
            console.log(`    badge: "${card.badge}"`);
            console.log(`    value: "${card.value || ''}"`);
            console.log(`    icon: ${JSON.stringify(card.icon)}`);
          }
        }
        // Also dump the raw HTML if available
        if (slide.html) {
          console.log(`\n  HTML length: ${slide.html.length}`);
          console.log(`  HTML snippet: ${slide.html.substring(0, 500)}`);
        }
      }
    }
  }
  
  // Also check slideData column
  if (r.slideData && typeof r.slideData === 'object') {
    const sd = r.slideData as Record<string, any>;
    for (const [key, slide] of Object.entries(sd)) {
      if ((slide as any).layoutId === 'card-grid') {
        console.log(`\n\n=== slideData Slide ${key}: card-grid ===`);
        console.log(JSON.stringify(slide, null, 2).substring(0, 2000));
      }
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
