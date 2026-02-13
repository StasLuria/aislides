/**
 * PDF Export — Renders HTML slides to a multi-page PDF using Puppeteer.
 * Each slide becomes one landscape page (1280×720 scaled to fit A4 landscape).
 */
import puppeteer from "puppeteer";
import { renderSlide, BASE_CSS } from "./pipeline/templateEngine";

/**
 * Generate a PDF buffer from slide data.
 * Each slide is rendered as a full-page landscape element.
 */
export async function generatePdf(
  slides: Array<{ layoutId: string; data: Record<string, any> }>,
  title: string,
  themeCss: string,
): Promise<Buffer> {
  // Build a single HTML document with all slides as separate pages
  const slideHtmls = slides.map((slide, index) => {
    return renderSlide(slide.layoutId, {
      ...slide.data,
      _slide_index: index,
      _slideNumber: index + 1,
      _totalSlides: slides.length,
      _presentationTitle: title,
    });
  });

  const hasCharts = slides.some((s) => s.layoutId === "chart-slide");

  // Build chart init scripts
  let chartScripts = "";
  if (hasCharts) {
    slides.forEach((slide, index) => {
      if (slide.layoutId === "chart-slide" && slide.data.chartData) {
        const cd = slide.data.chartData;
        chartScripts += `
(function() {
  var ctx = document.getElementById('chart-${index}');
  if (ctx) {
    new Chart(ctx, {
      type: '${cd.type || "bar"}',
      data: ${JSON.stringify({ labels: cd.labels || [], datasets: cd.datasets || [] })},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
})();
`;
      }
    });
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>${BASE_CSS}</style>
  <style>${themeCss}</style>
  ${hasCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>' : ""}
  <style>
    @page {
      size: 1280px 720px;
      margin: 0;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: white; }
    .pdf-slide {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
    }
    .pdf-slide:last-child {
      page-break-after: auto;
    }
  </style>
</head>
<body>
  ${slideHtmls
    .map(
      (html) => `<div class="pdf-slide">${html}</div>`,
    )
    .join("\n  ")}
  ${chartScripts ? `<script>${chartScripts}</script>` : ""}
</body>
</html>`;

  // Launch puppeteer and render to PDF
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent(fullHtml, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait a bit for fonts and charts to render
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500)));

    const pdfBuffer = await page.pdf({
      width: "1280px",
      height: "720px",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
