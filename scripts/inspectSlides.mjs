import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT finalHtmlSlides, title, prompt, config, themeCss FROM presentations WHERE presentationId = ? LIMIT 1",
  ["eGLPRD89pdJdqPTI"]
);
const p = rows[0];
if (!p) { console.log("NOT FOUND"); process.exit(1); }

const raw = p.finalHtmlSlides;
const slides = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
console.log("Total slides:", slides.length);
console.log("Title:", p.title);

for (let i = 0; i < slides.length; i++) {
  const s = slides[i];
  const layoutId = s.layoutId || s.layout_id || "unknown";
  const data = s.data || {};
  console.log(`\nSlide ${i+1}: layoutId=${layoutId}`);
  console.log("  data keys:", Object.keys(data).join(", "));
  
  if (data.mainStat) console.log("  mainStat:", JSON.stringify(data.mainStat).substring(0, 200));
  if (data.supportingStats) console.log("  supportingStats count:", data.supportingStats?.length);
  if (data.bullets) console.log("  bullets count:", data.bullets?.length, "sample:", JSON.stringify(data.bullets?.[0]).substring(0, 200));
  if (data.chartData) console.log("  chartData type:", data.chartData?.type, "labels:", data.chartData?.labels?.length);
  if (data.metrics) console.log("  metrics count:", data.metrics?.length);
  if (data.cards) console.log("  cards count:", data.cards?.length);
  if (data.features) console.log("  features count:", data.features?.length);
  if (data.headers) console.log("  headers:", JSON.stringify(data.headers).substring(0, 200));
  if (data.formulaParts) console.log("  formulaParts count:", data.formulaParts?.length);
  if (data.criteria) console.log("  criteria count:", data.criteria?.length);
  if (data.events) console.log("  events count:", data.events?.length);
  if (data.steps) console.log("  steps count:", data.steps?.length);
  if (data.table_data) console.log("  table_data rows:", data.table_data?.rows?.length, "headers:", data.table_data?.headers?.length);
  if (data.verdictText) console.log("  verdictText:", data.verdictText?.substring(0, 100));
  if (data.image) console.log("  image url:", data.image?.url?.substring(0, 80));
}

await conn.end();
