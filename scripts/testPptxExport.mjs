/**
 * Test PPTX export by downloading from the API and saving locally
 */
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

async function main() {
  // First, get list of completed presentations
  const listRes = await fetch(`${BASE_URL}/api/v1/presentations`);
  if (!listRes.ok) {
    console.error("Failed to list presentations:", listRes.status, await listRes.text());
    process.exit(1);
  }
  const presentations = await listRes.json();
  const completed = presentations.filter(p => p.status === "completed");
  
  if (completed.length === 0) {
    console.error("No completed presentations found");
    process.exit(1);
  }

  console.log(`Found ${completed.length} completed presentations:`);
  completed.forEach(p => {
    console.log(`  - ${p.presentation_id}: "${p.title}" (${p.slide_count} slides)`);
  });

  // Export the most recent one
  const target = completed[0];
  console.log(`\nExporting: "${target.title}" (${target.presentation_id})...`);

  // First, let's look at the slide data to understand what's being passed
  const slidesRes = await fetch(`${BASE_URL}/api/v1/presentations/${target.presentation_id}/slides`);
  if (slidesRes.ok) {
    const slidesData = await slidesRes.json();
    console.log(`\nSlide data (${slidesData.slides?.length || 0} slides):`);
    (slidesData.slides || []).forEach((s, i) => {
      console.log(`  Slide ${i + 1}: layout="${s.layoutId || s.layout_id}" title="${s.data?.title || '?'}"`);
      console.log(`    Data keys: ${Object.keys(s.data || {}).join(", ")}`);
    });
  }

  // Export PPTX
  const pptxRes = await fetch(`${BASE_URL}/api/v1/presentations/${target.presentation_id}/export/pptx`);
  if (!pptxRes.ok) {
    console.error("PPTX export failed:", pptxRes.status, await pptxRes.text());
    process.exit(1);
  }

  const buffer = Buffer.from(await pptxRes.arrayBuffer());
  const outPath = path.join("/home/ubuntu", "test-export.pptx");
  fs.writeFileSync(outPath, buffer);
  console.log(`\nPPTX saved to: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Also export PDF for comparison
  const pdfRes = await fetch(`${BASE_URL}/api/v1/presentations/${target.presentation_id}/export/pdf`);
  if (pdfRes.ok) {
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfPath = path.join("/home/ubuntu", "test-export.pdf");
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`PDF saved to: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
