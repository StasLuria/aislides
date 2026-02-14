import { getDb } from './server/db.ts';
import { presentations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('No DB connection'); process.exit(1); }
  
  const [preso] = await db.select({ 
    finalHtmlSlides: presentations.finalHtmlSlides,
    themeCss: presentations.themeCss,
  }).from(presentations).where(eq(presentations.id, 720002));
  
  if (!preso) { console.log('Not found'); process.exit(1); }
  
  const htmlSlides = preso.finalHtmlSlides;
  if (htmlSlides && Array.isArray(htmlSlides)) {
    const slide6 = htmlSlides[5]; // index 5 = slide 6
    const html = typeof slide6 === 'string' ? slide6 : (slide6?.html || '');
    
    console.log('=== SLIDE 6 FULL HTML ===');
    console.log(html);
    
    console.log('\n\n=== THEME CSS (first 1000) ===');
    console.log((preso.themeCss || '').substring(0, 1000));
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
