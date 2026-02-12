/**
 * Template Engine — renders slide HTML from layout templates + data.
 * Uses Nunjucks for Jinja2-compatible template rendering.
 * Templates are embedded as strings (ported from Python backend).
 */
import { processSlideDataMarkdown } from "./markdownInline";

// ═══════════════════════════════════════════════════════
// LAYOUT TEMPLATES (Jinja2/Nunjucks syntax)
// ═══════════════════════════════════════════════════════

const LAYOUT_TEMPLATES: Record<string, string> = {
  "title-slide": `<div style="position: relative; z-index: 10; display: flex; height: 100%; padding: 48px 64px 32px;">
  <div class="slide-decor-circle slide-decor-top-right"></div>
  <div class="slide-decor-circle slide-decor-bottom-left"></div>
  {% if image and image.url %}
  <div style="flex: 1 1 0%; display: flex; align-items: center; justify-content: center; padding-right: 32px; min-width: 0;">
    <div style="width: 100%; max-width: 512px; height: 320px; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
      <img src="{{ image.url }}" alt="{{ image.alt | default('') }}" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  </div>
  {% else %}
  <div style="flex: 1 1 0%; display: flex; align-items: center; justify-content: center; padding-right: 32px; min-width: 0;">
    <div style="width: 100%; max-width: 512px; height: 320px; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); background: linear-gradient(135deg, color-mix(in srgb, var(--primary-accent-color, #9333ea) 20%, white), color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 15%, white)); position: relative;">
      <div style="position: absolute; top: -30px; right: -30px; width: 180px; height: 180px; border-radius: 50%; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 12%, transparent);"></div>
      <div style="position: absolute; bottom: -20px; left: -20px; width: 120px; height: 120px; border-radius: 50%; background: color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 10%, transparent);"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, transparent);"></div>
    </div>
  </div>
  {% endif %}
  <div style="flex: 1 1 0%; display: flex; flex-direction: column; justify-content: center; padding-left: 32px; min-width: 0;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 48px; font-weight: 700; line-height: 1.1; margin: 0 0 20px 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-bottom: 20px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.55; margin: 0 0 24px 0;">{{ description }}</p>
    {% endif %}
    <div style="border-radius: 12px; padding: 16px; border: 1px solid #e5e7eb; background: rgba(255,255,255,0.5); backdrop-filter: blur(8px);">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary-accent-color, #9333ea);">
          <span style="font-weight: 700; font-size: 14px; color: white;">{{ initials | default('') }}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="color: var(--text-heading-color, #111827); font-size: 18px; font-weight: 700;">{{ presenterName | default('') }}</span>
          <span style="color: var(--text-body-color, #4b5563); font-size: 14px; font-weight: 500;">{{ presentationDate | default('') }}</span>
        </div>
      </div>
    </div>
  </div>
</div>`,

  "section-header": `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 0 64px; text-align: center; background: var(--slide-bg-accent-gradient, var(--primary-accent-color)); position: relative; overflow: hidden;">
  <div style="position: absolute; top: -120px; right: -120px; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,0.06); pointer-events: none;"></div>
  <div style="position: absolute; bottom: -80px; left: -80px; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none;"></div>
  <div style="position: absolute; top: 50%; left: 10%; width: 150px; height: 150px; border-radius: 50%; background: rgba(255,255,255,0.03); pointer-events: none; transform: translateY(-50%);"></div>
  <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; max-width: 900px;">
    <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.4); border-radius: 2px; margin-bottom: 32px;"></div>
    <h1 style="color: #ffffff; letter-spacing: -0.02em; font-size: 60px; font-weight: 700; line-height: 1.1; margin: 0 0 24px 0;">{{ title }}</h1>
    {% if subtitle %}
    <p style="color: rgba(255,255,255,0.85); max-width: 640px; font-size: 20px; line-height: 1.5; margin: 0;">{{ subtitle }}</p>
    {% endif %}
    <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.4); border-radius: 2px; margin-top: 32px;"></div>
  </div>
</div>`,

  "text-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
    {% if icon and icon.url %}
    <div class="icon-circle"><img src="{{ icon.url }}" alt="{{ icon.name | default('') }}" /></div>
    {% endif %}
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
  </div>
  <div class="accent-line" style="flex-shrink: 0; margin-bottom: 24px;"></div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center;">
    <div style="display: flex; flex-direction: column; gap: 14px;">
      {% for bullet in bullets | default([]) %}
      <div class="bullet-row">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: 17px; line-height: 1.3;">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563); font-size: 15px; line-height: 1.55; margin-top: 4px;">{{ bullet.description | default('') }}</div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "two-column": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; width: 100%;">
      <div class="card" style="display: flex; flex-direction: column;">
        <h2 style="color: var(--text-heading-color, #111827); font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">{{ leftColumn.title | default('') }}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          {% for bullet in leftColumn.bullets | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5;">{{ bullet }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
      <div class="card" style="display: flex; flex-direction: column;">
        <h2 style="color: var(--text-heading-color, #111827); font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">{{ rightColumn.title | default('') }}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          {% for bullet in rightColumn.bullets | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: var(--secondary-accent-color, #3b82f6);"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5;">{{ bullet }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
    </div>
  </div>
</div>`,

  "image-text": `<div style="display: flex; height: 100%; padding: 40px 64px; gap: 32px;">
  <div style="flex: 1 1 0%; display: flex; align-items: center; justify-content: center; min-width: 0;">
    <div style="width: 100%; height: 100%; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
      {% if image and image.url %}
      <img src="{{ image.url }}" alt="{{ image.alt | default('') }}" style="width: 100%; height: 100%; object-fit: cover;" />
      {% else %}
      <div style="width: 100%; height: 100%; background: linear-gradient(135deg, color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, #f3f4f6), color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 10%, #f3f4f6)); position: relative; overflow: hidden;">
        <div style="position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, transparent);"></div>
        <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; border-radius: 50%; background: color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 8%, transparent);"></div>
      </div>
      {% endif %}
    </div>
  </div>
  <div style="flex: 1 1 0%; display: flex; flex-direction: column; justify-content: center; min-width: 0;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 36px; font-weight: 700; line-height: 1.15; margin: 0 0 16px 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-bottom: 20px;"></div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      {% for bullet in bullets | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: 16px; line-height: 1.3;">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.55; margin-top: 3px;">{{ bullet.description | default('') }}</div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "image-fullscreen": `<div style="position: relative; height: 100%; overflow: hidden;">
  {% if backgroundImage and backgroundImage.url %}
  <img src="{{ backgroundImage.url }}" alt="{{ backgroundImage.alt | default('') }}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />
  {% else %}
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
  {% endif %}
  <div class="gradient-overlay-bottom" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10;"></div>
  <div style="position: relative; z-index: 20; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; padding: 0 64px 64px;">
    <h1 style="color: #ffffff; font-size: 48px; font-weight: 700; line-height: 1.15; margin: 0 0 16px 0;">{{ title }}</h1>
    {% if subtitle %}
    <p style="color: rgba(255,255,255,0.8); font-size: 20px; line-height: 1.5; max-width: 672px; margin: 0;">{{ subtitle }}</p>
    {% endif %}
  </div>
</div>`,

  "quote-slide": `<div style="position: relative; height: 100%; overflow: hidden;">
  {% if backgroundImage and backgroundImage.url %}
  <img src="{{ backgroundImage.url }}" alt="{{ backgroundImage.alt | default('') }}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />
  {% else %}
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
  {% endif %}
  <div class="gradient-overlay-dark" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10;"></div>
  <div style="position: relative; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 0 80px; text-align: center;">
    <div style="font-size: 80px; color: var(--primary-accent-color, #9333ea); opacity: 0.6; line-height: 1;">\"</div>
    <blockquote style="color: #ffffff; font-size: 30px; line-height: 1.5; max-width: 768px; margin: 0 0 32px 0;">{{ quote }}</blockquote>
    <div class="accent-line-center" style="margin-bottom: 16px;"></div>
    <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0;">{{ author | default('') }}</p>
    {% if role %}
    <p style="color: rgba(255,255,255,0.7); font-size: 16px; margin: 4px 0 0 0;">{{ role }}</p>
    {% endif %}
  </div>
</div>`,

  "chart-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <canvas id="chart-{{ _slide_index | default(0) }}" style="max-width: 100%; max-height: 100%;"></canvas>
  </div>
</div>`,

  "table-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="width: 100%; border-radius: 16px; overflow: hidden; border: 1px solid var(--card-border-color, #e5e7eb);">
      <table>
        <thead>
          <tr>
            {% for header in headers | default([]) %}
            <th>{{ header }}</th>
            {% endfor %}
          </tr>
        </thead>
        <tbody>
          {% for row in rows | default([]) %}
          <tr>
            {% for cell in row %}
            <td>{{ cell }}</td>
            {% endfor %}
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
</div>`,

  "icons-numbers": `{% set m_count = metrics | default([]) | length %}
{% set m_count = m_count if m_count > 0 else 1 %}
<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 32px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; justify-content: center; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat({{ m_count }}, 1fr); gap: 32px; width: 100%; max-width: 1100px;">
      {% for metric in metrics | default([]) %}
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; min-width: 0; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08)); border-radius: 16px; padding: 28px 16px; box-shadow: var(--card-shadow, 0 4px 24px rgba(0,0,0,0.08));">
        {% if metric.icon and metric.icon.url %}
        <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="{{ metric.icon.url }}" alt="" style="width: 24px; height: 24px; filter: brightness(0) saturate(100%);" />
        </div>
        {% else %}
        <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: var(--primary-accent-color, #9333ea); font-size: 20px; font-weight: 700;">{{ forloop.counter }}</span>
        </div>
        {% endif %}
        <div style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1;">{{ metric.value }}</div>
        <div style="color: var(--primary-accent-color, #9333ea); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">{{ metric.label }}</div>
        {% if metric.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.5; max-width: 220px;">{{ metric.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "timeline": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="position: relative; width: 100%;">
      <div style="position: absolute; left: 24px; top: 0; bottom: 0; width: 2px; background: var(--primary-accent-color, #9333ea); opacity: 0.3;"></div>
      <div style="display: flex; flex-direction: column; gap: 20px;">
        {% for event in events | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 20px; padding-left: 12px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); flex-shrink: 0; display: flex; align-items: center; justify-content: center; z-index: 1;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: white;"></div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="color: var(--primary-accent-color, #9333ea); font-size: 13px; font-weight: 600; margin-bottom: 4px;">{{ event.date | default('') }}</div>
            <div style="color: var(--text-heading-color, #111827); font-size: 18px; font-weight: 600;">{{ event.title }}</div>
            {% if event.description %}
            <div style="color: var(--text-body-color, #4b5563); font-size: 14px; margin-top: 4px;">{{ event.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "process-steps": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat({{ steps | default([]) | length }}, 1fr); gap: 24px; width: 100%;">
      {% for step in steps | default([]) %}
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 24px; font-weight: 700;">{{ step.number | default(loop.index) }}</span>
        </div>
        <div style="color: var(--text-heading-color, #111827); font-size: 18px; font-weight: 600;">{{ step.title }}</div>
        {% if step.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 13px; line-height: 1.5;">{{ step.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "comparison": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; width: 100%;">
      <div class="card" style="border-left: 4px solid {{ optionA.color | default('#22c55e') }}; display: flex; flex-direction: column;">
        <h2 style="color: var(--text-heading-color, #111827); font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">{{ optionA.title | default('Option A') }}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          {% for point in optionA.points | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: {{ optionA.color | default('#22c55e') }};"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5;">{{ point }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
      <div class="card" style="border-left: 4px solid {{ optionB.color | default('#ef4444') }}; display: flex; flex-direction: column;">
        <h2 style="color: var(--text-heading-color, #111827); font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">{{ optionB.title | default('Option B') }}</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          {% for point in optionB.points | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: {{ optionB.color | default('#ef4444') }};"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5;">{{ point }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
    </div>
  </div>
</div>`,

  "final-slide": `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 0 64px; text-align: center; background: var(--slide-bg-accent-gradient, var(--primary-accent-color)); position: relative; overflow: hidden;">
  <div class="slide-decor-circle slide-decor-top-right"></div>
  <div class="slide-decor-circle slide-decor-bottom-left"></div>
  <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center;">
    <h1 style="color: #ffffff; font-size: 60px; font-weight: 700; line-height: 1.05; margin: 0 0 16px 0;">{{ title | default('Спасибо!') }}</h1>
    <div style="width: 80px; height: 4px; background: rgba(255,255,255,0.5); border-radius: 2px; margin-bottom: 24px;"></div>
    {% if subtitle %}
    <p style="color: rgba(255,255,255,0.85); font-size: 20px; line-height: 1.5; max-width: 672px; margin: 0 0 32px 0;">{{ subtitle }}</p>
    {% endif %}
    {% if thankYouText %}
    <p style="color: rgba(255,255,255,0.8); font-size: 18px; margin: 0 0 32px 0;">{{ thankYouText }}</p>
    {% endif %}
    {% if contactInfo %}
    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 24px;">
      {% for contact in contactInfo %}
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: rgba(255,255,255,0.9); font-size: 18px;">{{ contact.value }}</span>
      </div>
      {% endfor %}
    </div>
    {% endif %}
  </div>
</div>`,

  "agenda-table-of-contents": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center;">
    <div style="display: flex; flex-direction: column; gap: 14px;">
      {% for section in sections | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 20px; padding: 14px 16px; border-radius: 12px; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 5%, white);">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: white; font-weight: 700; font-size: 15px;">{{ section.number | default(loop.index) }}</span>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-size: 17px; font-weight: 600;">{{ section.title }}</div>
          {% if section.description %}
          <div style="color: var(--text-body-color, #4b5563); font-size: 14px; margin-top: 4px;">{{ section.description }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "team-profiles": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if companyDescription %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; margin: 12px 0 0 0;">{{ companyDescription }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat({{ teamMembers | default([]) | length }}, 1fr); gap: 24px; width: 100%;">
      {% for member in teamMembers | default([]) %}
      <div class="card" style="text-align: center;">
        <div style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, white);">
          {% if member.image and member.image.url %}
          <img src="{{ member.image.url }}" alt="{{ member.name }}" style="width: 100%; height: 100%; object-fit: cover;" />
          {% else %}
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: var(--primary-accent-color, #9333ea);">{{ member.name[0] | default('?') }}</div>
          {% endif %}
        </div>
        <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: 16px;">{{ member.name }}</div>
        <div style="color: var(--primary-accent-color, #9333ea); font-size: 13px; margin-top: 4px;">{{ member.role | default('') }}</div>
        {% if member.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 12px; margin-top: 8px; line-height: 1.4;">{{ member.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "logo-grid": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; width: 100%; align-items: center; justify-items: center;">
      {% for logo in logos | default([]) %}
      <div class="card" style="width: 200px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
        {% if logo.image and logo.image.url %}
        <img src="{{ logo.image.url }}" alt="{{ logo.name }}" style="max-width: 120px; max-height: 60px; object-fit: contain;" />
        {% else %}
        <div style="font-size: 14px; font-weight: 600; color: var(--text-heading-color, #111827);">{{ logo.name }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "video-embed": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <div style="position: relative; width: 800px; height: 400px; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
      {% if thumbnailImage and thumbnailImage.url %}
      <img src="{{ thumbnailImage.url }}" alt="{{ thumbnailImage.alt | default('Video thumbnail') }}" style="width: 100%; height: 100%; object-fit: cover;" />
      {% else %}
      <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
      {% endif %}
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3);"></div>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--primary-accent-color, #9333ea); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
    </div>
  </div>
</div>`,

  // ═══════════════════════════════════════════════════════
  // NEW LAYOUTS — Sprint 3
  // ═══════════════════════════════════════════════════════

  "waterfall-chart": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: flex-end; gap: 4px; padding-bottom: 40px;">
    {% for bar in bars | default([]) %}
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <div style="font-size: 14px; font-weight: 600; color: var(--text-heading-color, #111827);">{{ bar.value | default('') }}</div>
      <div style="width: 100%; height: {{ bar.height | default('50') }}%; min-height: 24px; border-radius: 8px 8px 0 0; background: {{ bar.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative; display: flex; align-items: center; justify-content: center;">
        {% if bar.change %}
        <span style="font-size: 11px; font-weight: 600; color: white;">{{ bar.change }}</span>
        {% endif %}
      </div>
      <div style="font-size: 12px; color: var(--text-body-color, #4b5563); text-align: center; font-weight: 500;">{{ bar.label | default('') }}</div>
    </div>
    {% endfor %}
  </div>
</div>`,

  "swot-analysis": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px;">
    <div style="border-radius: 16px; padding: 24px; background: color-mix(in srgb, #22c55e 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #22c55e 20%, transparent); display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #22c55e; display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <h2 style="color: #16a34a; font-size: 18px; font-weight: 700; margin: 0;">{{ strengths.title | default('Strengths') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        {% for item in strengths.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: #22c55e;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 16px; padding: 24px; background: color-mix(in srgb, #ef4444 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #ef4444 20%, transparent); display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #ef4444; display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 style="color: #dc2626; font-size: 18px; font-weight: 700; margin: 0;">{{ weaknesses.title | default('Weaknesses') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        {% for item in weaknesses.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: #ef4444;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 16px; padding: 24px; background: color-mix(in srgb, #3b82f6 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #3b82f6 20%, transparent); display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #3b82f6; display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h2 style="color: #2563eb; font-size: 18px; font-weight: 700; margin: 0;">{{ opportunities.title | default('Opportunities') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        {% for item in opportunities.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: #3b82f6;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 16px; padding: 24px; background: color-mix(in srgb, #f59e0b 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #f59e0b 20%, transparent); display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #f59e0b; display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
        </div>
        <h2 style="color: #d97706; font-size: 18px; font-weight: 700; margin: 0;">{{ threats.title | default('Threats') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        {% for item in threats.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: #f59e0b;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 14px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "funnel": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;">
    {% for stage in stages | default([]) %}
    {% set widthPercent = 100 - (loop.index0 * (60 / (stages | length))) %}
    <div style="width: {{ widthPercent }}%; display: flex; align-items: center; border-radius: 12px; padding: 14px 24px; background: {{ stage.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative; min-height: 52px;">
      <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
        <div style="font-size: 28px; font-weight: 700; color: rgba(255,255,255,0.9); min-width: 60px;">{{ stage.value | default('') }}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 16px; font-weight: 600; color: #ffffff;">{{ stage.title | default('') }}</div>
          {% if stage.description %}
          <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 2px;">{{ stage.description }}</div>
          {% endif %}
        </div>
        {% if stage.conversion %}
        <div style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); background: rgba(0,0,0,0.15); padding: 4px 10px; border-radius: 20px;">{{ stage.conversion }}</div>
        {% endif %}
      </div>
    </div>
    {% endfor %}
  </div>
</div>`,

  "roadmap": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="width: 100%; position: relative;">
      <div style="position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 20%, transparent); border-radius: 2px; transform: translateY(-50%);"></div>
      <div style="display: grid; grid-template-columns: repeat({{ milestones | default([]) | length }}, 1fr); gap: 16px; position: relative;">
        {% for milestone in milestones | default([]) %}
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          {% if loop.index0 % 2 == 0 %}
          <div style="margin-bottom: 12px; min-height: 80px; display: flex; flex-direction: column; justify-content: flex-end;">
            <div style="font-size: 12px; font-weight: 600; color: var(--primary-accent-color, #9333ea); text-transform: uppercase; letter-spacing: 0.05em;">{{ milestone.date | default('') }}</div>
            <div style="font-size: 15px; font-weight: 600; color: var(--text-heading-color, #111827); margin-top: 4px;">{{ milestone.title }}</div>
            {% if milestone.description %}
            <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px;">{{ milestone.description }}</div>
            {% endif %}
          </div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background: {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; border: 3px solid var(--card-background-color, #ffffff); box-shadow: 0 0 0 2px {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; z-index: 2;"></div>
          <div style="min-height: 80px;"></div>
          {% else %}
          <div style="min-height: 80px;"></div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background: {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; border: 3px solid var(--card-background-color, #ffffff); box-shadow: 0 0 0 2px {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; z-index: 2;"></div>
          <div style="margin-top: 12px; min-height: 80px; display: flex; flex-direction: column;">
            <div style="font-size: 12px; font-weight: 600; color: var(--primary-accent-color, #9333ea); text-transform: uppercase; letter-spacing: 0.05em;">{{ milestone.date | default('') }}</div>
            <div style="font-size: 15px; font-weight: 600; color: var(--text-heading-color, #111827); margin-top: 4px;">{{ milestone.title }}</div>
            {% if milestone.description %}
            <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px;">{{ milestone.description }}</div>
            {% endif %}
          </div>
          {% endif %}
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "pyramid": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <div style="display: flex; width: 100%; max-width: 1000px; gap: 32px;">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
        {% for level in levels | default([]) %}
        {% set widthPercent = 30 + (loop.index0 * (70 / (levels | length))) %}
        <div style="width: {{ widthPercent }}%; padding: 16px 20px; text-align: center; border-radius: 8px; background: {{ level.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative;">
          <div style="font-size: 15px; font-weight: 600; color: #ffffff;">{{ level.title | default('') }}</div>
        </div>
        {% endfor %}
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px;">
        {% for level in levels | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: {{ level.color | default('var(--primary-accent-color, #9333ea)') }};"></div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text-heading-color, #111827);">{{ level.title | default('') }}</div>
            {% if level.description %}
            <div style="font-size: 13px; color: var(--text-body-color, #4b5563); margin-top: 2px; line-height: 1.5;">{{ level.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "matrix-2x2": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <div style="position: relative; width: 100%; max-width: 900px; aspect-ratio: 1.4;">
      <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--card-border-color, #e5e7eb); transform: translateX(-50%);"></div>
      <div style="position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: var(--card-border-color, #e5e7eb); transform: translateY(-50%);"></div>
      {% if axisX %}
      <div style="position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); font-size: 13px; font-weight: 600; color: var(--text-body-color, #4b5563); letter-spacing: 0.05em;">{{ axisX }}</div>
      {% endif %}
      {% if axisY %}
      <div style="position: absolute; left: -32px; top: 50%; transform: translateY(-50%) rotate(-90deg); font-size: 13px; font-weight: 600; color: var(--text-body-color, #4b5563); letter-spacing: 0.05em; white-space: nowrap;">{{ axisY }}</div>
      {% endif %}
      <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; height: 100%; padding: 8px;">
        {% for quadrant in quadrants | default([]) %}
        <div style="border-radius: 12px; padding: 20px; background: {{ quadrant.color | default('color-mix(in srgb, var(--primary-accent-color, #9333ea) 6%, var(--card-background-color, #ffffff))') }}; display: flex; flex-direction: column;">
          <div style="font-size: 16px; font-weight: 700; color: var(--text-heading-color, #111827); margin-bottom: 8px;">{{ quadrant.title | default('') }}</div>
          {% if quadrant.description %}
          <div style="font-size: 13px; color: var(--text-body-color, #4b5563); line-height: 1.5;">{{ quadrant.description }}</div>
          {% endif %}
          {% if quadrant.items %}
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
            {% for item in quadrant.items %}
            <div style="font-size: 12px; color: var(--text-body-color, #4b5563); display: flex; align-items: center; gap: 6px;">
              <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); flex-shrink: 0;"></div>
              {{ item }}
            </div>
            {% endfor %}
          </div>
          {% endif %}
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "pros-cons": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center;">
    <div class="card" style="border-top: 4px solid #22c55e; display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style="color: #16a34a; font-size: 20px; font-weight: 700; margin: 0;">{{ pros.title | default('Advantages') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        {% for item in pros.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: color-mix(in srgb, #22c55e 15%, transparent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 15px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div class="card" style="border-top: 4px solid #ef4444; display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <h2 style="color: #dc2626; font-size: 20px; font-weight: 700; margin: 0;">{{ cons.title | default('Disadvantages') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        {% for item in cons.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: color-mix(in srgb, #ef4444 15%, transparent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <span style="color: var(--text-body-color, #4b5563); font-size: 15px; line-height: 1.5;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "checklist": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%;">
      {% for item in items | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; border-radius: 12px; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08)); box-shadow: var(--card-shadow, 0 2px 8px rgba(0,0,0,0.04));">
        {% if item.done %}
        <div style="width: 24px; height: 24px; border-radius: 6px; background: #22c55e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        {% else %}
        <div style="width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--card-border-color, #d1d5db); flex-shrink: 0; margin-top: 1px;"></div>
        {% endif %}
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-heading-color, #111827); line-height: 1.3;{% if item.done %} text-decoration: line-through; opacity: 0.6;{% endif %}">{{ item.title | default('') }}</div>
          {% if item.description %}
          <div style="font-size: 13px; color: var(--text-body-color, #4b5563); margin-top: 3px; line-height: 1.4;">{{ item.description }}</div>
          {% endif %}
        </div>
        {% if item.status %}
        <div style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: {{ item.statusColor | default('color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, transparent)') }}; color: {{ item.statusTextColor | default('var(--primary-accent-color, #9333ea)') }}; white-space: nowrap; flex-shrink: 0;">{{ item.status }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "highlight-stats": `<div style="display: flex; flex-direction: column; height: 100%; padding: 48px 64px 40px;">
  <div style="flex-shrink: 0; margin-bottom: 24px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: 42px; font-weight: 700; line-height: 1.1; margin: 0;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; width: 100%;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 32px; border-radius: 20px; background: var(--slide-bg-accent-gradient, var(--primary-accent-color, #9333ea)); text-align: center;">
        <div style="font-size: 64px; font-weight: 800; color: #ffffff; line-height: 1;">{{ mainStat.value | default('') }}</div>
        <div style="font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.9); margin-top: 12px;">{{ mainStat.label | default('') }}</div>
        {% if mainStat.description %}
        <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 8px; max-width: 280px;">{{ mainStat.description }}</div>
        {% endif %}
      </div>
      <div style="display: flex; flex-direction: column; gap: 16px; justify-content: center;">
        {% for stat in supportingStats | default([]) %}
        <div class="card" style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 32px; font-weight: 700; color: var(--primary-accent-color, #9333ea); min-width: 80px;">{{ stat.value | default('') }}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text-heading-color, #111827);">{{ stat.label | default('') }}</div>
            {% if stat.description %}
            <div style="font-size: 13px; color: var(--text-body-color, #4b5563); margin-top: 2px;">{{ stat.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,
};

// ═══════════════════════════════════════════════════════
// BASE CSS (embedded from Python backend)
// ═══════════════════════════════════════════════════════
export const BASE_CSS = `/* ── Slide Foundation ─────────────────────────────────── */
.slide {
  width: 1280px;
  height: 720px;
  position: relative;
  overflow: hidden;
  font-family: var(--body-font-family, 'Inter'), system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-body-color, #4b5563);
  background: var(--slide-bg-gradient, var(--card-background-color, #ffffff));
  box-sizing: border-box;
}
.slide *, .slide *::before, .slide *::after { box-sizing: border-box; }
.slide h1, .slide h2, .slide h3, .slide h4 {
  font-family: var(--heading-font-family, 'Inter'), system-ui, sans-serif;
  margin: 0;
}
.slide p, .slide ul, .slide ol, .slide blockquote { margin: 0; }
/* ── Flexbox ─────────────────────────────────────────── */
.slide .flex { display: flex; }
.slide .flex-col { flex-direction: column; }
.slide .flex-1 { flex: 1 1 0%; min-width: 0; min-height: 0; }
.slide .items-center { align-items: center; }
.slide .items-start { align-items: flex-start; }
.slide .justify-center { justify-content: center; }
.slide .justify-between { justify-content: space-between; }
.slide .justify-end { justify-content: flex-end; }
.slide .gap-2 { gap: 8px; }
.slide .gap-3 { gap: 12px; }
.slide .gap-4 { gap: 16px; }
.slide .gap-6 { gap: 24px; }
.slide .gap-8 { gap: 32px; }
.slide .flex-shrink-0 { flex-shrink: 0; }
.slide .flex-wrap { flex-wrap: wrap; }
/* ── Sizing ──────────────────────────────────────────── */
.slide .h-full { height: 100%; }
.slide .w-full { width: 100%; }
.slide .min-h-0 { min-height: 0; }
.slide .w-2 { width: 8px; }
.slide .h-2 { height: 8px; }
.slide .w-9 { width: 36px; }
.slide .h-9 { height: 36px; }
.slide .w-10 { width: 40px; }
.slide .h-10 { height: 40px; }
.slide .w-20 { width: 80px; }
.slide .h-20 { height: 80px; }
.slide .h-80 { height: 320px; }
/* ── Spacing ─────────────────────────────────────────── */
.slide .px-16 { padding-left: 64px; padding-right: 64px; }
.slide .px-20 { padding-left: 80px; padding-right: 80px; }
.slide .pt-10 { padding-top: 40px; }
.slide .pt-12 { padding-top: 48px; }
.slide .pb-8 { padding-bottom: 32px; }
.slide .pb-10 { padding-bottom: 40px; }
.slide .pb-16 { padding-bottom: 64px; }
.slide .pr-8 { padding-right: 32px; }
.slide .pl-8 { padding-left: 32px; }
.slide .p-4 { padding: 16px; }
.slide .mb-4 { margin-bottom: 16px; }
.slide .mb-6 { margin-bottom: 24px; }
.slide .mb-8 { margin-bottom: 32px; }
.slide .mt-3 { margin-top: 12px; }
.slide .mt-4 { margin-top: 16px; }
.slide .mt-2 { margin-top: 8px; }
.slide .mt-8 { margin-top: 32px; }
.slide .mt-1 { margin-top: 4px; }
.slide .space-y-3 > * + * { margin-top: 12px; }
.slide .space-y-4 > * + * { margin-top: 16px; }
.slide .space-y-6 > * + * { margin-top: 24px; }
/* ── Typography ──────────────────────────────────────── */
.slide .text-5xl { font-size: 48px; line-height: 1.1; }
.slide .text-6xl { font-size: 60px; line-height: 1.05; }
.slide .text-4xl { font-size: 36px; line-height: 1.15; }
.slide .text-3xl { font-size: 30px; line-height: 1.2; }
.slide .text-2xl { font-size: 24px; line-height: 1.3; }
.slide .text-xl { font-size: 20px; line-height: 1.4; }
.slide .text-lg { font-size: 18px; line-height: 1.5; }
.slide .text-base { font-size: 16px; line-height: 1.5; }
.slide .text-sm { font-size: 14px; line-height: 1.5; }
.slide .font-bold { font-weight: 700; }
.slide .font-semibold { font-weight: 600; }
.slide .font-medium { font-weight: 500; }
.slide .leading-tight { line-height: 1.15; }
.slide .leading-relaxed { line-height: 1.65; }
.slide .text-center { text-align: center; }
.slide .max-w-2xl { max-width: 672px; }
.slide .max-w-3xl { max-width: 768px; }
.slide .max-w-lg { max-width: 512px; }
/* ── Border & Radius ─────────────────────────────────── */
:root {
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 20px; --radius-full: 9999px;
}
.slide .rounded-full { border-radius: 9999px; }
.slide .rounded-xl { border-radius: 16px; }
.slide .rounded-2xl { border-radius: 20px; }
.slide .rounded-lg { border-radius: 12px; }
.slide .border { border: 1px solid #e5e7eb; }
/* ── Shadows ─────────────────────────────────────────── */
.slide .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.slide .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
.slide .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
/* ── Colors ──────────────────────────────────────────── */
.slide .bg-white { background-color: #ffffff; }
.slide .text-white { color: #ffffff; }
.slide .text-white\\/70 { color: rgba(255,255,255,0.7); }
.slide .text-white\\/80 { color: rgba(255,255,255,0.8); }
/* ── Positioning ─────────────────────────────────────── */
.slide .relative { position: relative; }
.slide .absolute { position: absolute; }
.slide .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
.slide .z-10 { z-index: 10; }
.slide .z-20 { z-index: 20; }
.slide .overflow-hidden { overflow: hidden; }
.slide .object-cover { object-fit: cover; }
.slide .object-contain { object-fit: contain; }
/* ── Slide Footer ──────────────────────────────────────── */
.slide-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 48px;
  z-index: 50;
  pointer-events: none;
}
.slide-footer-title {
  font-family: var(--body-font-family, 'Inter'), system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-body-color, #4b5563);
  opacity: 0.5;
  letter-spacing: 0.02em;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slide-footer-number {
  font-family: var(--body-font-family, 'Inter'), system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-body-color, #4b5563);
  opacity: 0.5;
  letter-spacing: 0.05em;
}
/* Footer on accent slides (section-header) uses white text */
.slide.slide-accent .slide-footer-title,
.slide.slide-accent .slide-footer-number {
  color: rgba(255, 255, 255, 0.5);
}
/* ── Decorative ──────────────────────────────────────── */
.accent-line { width: 80px; height: 4px; background: var(--primary-accent-color); border-radius: 2px; }
.accent-line-center { width: 80px; height: 4px; background: var(--primary-accent-color); margin-left: auto; margin-right: auto; border-radius: 2px; }
.icon-circle { width: 40px; height: 40px; border-radius: 9999px; background: var(--primary-accent-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-circle img, .icon-circle svg { width: 20px; height: 20px; filter: brightness(0) invert(1); }
.bullet-row { display: flex; align-items: flex-start; gap: 16px; padding: 16px; border-radius: 12px; background: var(--decorative-shape-color, color-mix(in srgb, var(--primary-accent-color) 10%, transparent)); border: 1px solid var(--card-border-color, rgba(0,0,0,0.05)); }
.card { padding: 24px; border-radius: 16px; border: 1px solid var(--card-border-color, #e5e7eb); background: var(--card-background-gradient, var(--card-background-color, #ffffff)); box-shadow: var(--card-shadow, 0 2px 8px rgba(0,0,0,0.04)); }
.gradient-overlay-bottom { background: linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.2) 50%, transparent); }
.gradient-overlay-dark { background: rgba(0,0,0,0.5); }
/* ── Decorative Shapes ──────────────────────────────── */
.slide-decor-circle { position: absolute; border-radius: 50%; background: var(--decorative-shape-color, rgba(0,0,0,0.03)); pointer-events: none; }
.slide-decor-top-right { top: -80px; right: -80px; width: 300px; height: 300px; }
.slide-decor-bottom-left { bottom: -60px; left: -60px; width: 200px; height: 200px; }
/* ── Accent Gradient Slide (for section headers, title, final) ── */
.slide.slide-accent {
  background: var(--slide-bg-accent-gradient, var(--primary-accent-color));
  color: #ffffff;
}
/* ── Tables ──────────────────────────────────────────── */
.slide table { width: 100%; border-collapse: collapse; }
.slide thead tr { background: var(--primary-accent-color); }
.slide th { padding: 16px 24px; text-align: left; color: #ffffff; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
.slide tbody tr { border-bottom: 1px solid #f3f4f6; }
.slide tbody tr:nth-child(even) { background-color: var(--decorative-shape-color, #f9fafb); }
.slide tbody tr:nth-child(odd) { background-color: var(--card-background-color, #ffffff); }
.slide td { padding: 12px 24px; font-size: 14px; color: var(--text-body-color, #4b5563); }
.slide .border { border: 1px solid var(--card-border-color, #e5e7eb); }
`;

// ═══════════════════════════════════════════════════════
// SIMPLE TEMPLATE RENDERER (Nunjucks-like)
// ═══════════════════════════════════════════════════════

/**
 * Minimal Jinja2/Nunjucks-style template renderer.
 * Supports: {{ var }}, {% if %}, {% for %}, {% endif %}, {% endfor %}, filters.
 */
function renderTemplate(template: string, data: Record<string, any>): string {
  // Pre-process: handle {% set %} directives
  let processed = template.replace(
    /\{%\s*set\s+(\w+)\s*=\s*(.+?)\s*%\}/g,
    (_match, varName, expr) => {
      try {
        data[varName] = evalExpression(expr, data);
      } catch { /* ignore */ }
      return "";
    }
  );

  // Process for loops first (can be nested)
  processed = processForLoops(processed, data);

  // Process if/elif/else blocks
  processed = processIfBlocks(processed, data);

  // Replace variable expressions {{ ... }}
  processed = processed.replace(/\{\{(.+?)\}\}/g, (_match, expr) => {
    try {
      const val = evalExpression(expr.trim(), data);
      return val !== undefined && val !== null ? String(val) : "";
    } catch {
      return "";
    }
  });

  return processed;
}

function processForLoops(template: string, data: Record<string, any>): string {
  let result = template;
  let safety = 0;

  // Use balanced matching: find outermost {% for %}...{% endfor %} pairs
  while (result.includes("{% for") && safety < 20) {
    safety++;
    const forStart = result.search(/\{%[-\s]*for\s+/);
    if (forStart === -1) break;

    // Parse the for tag
    const tagEnd = result.indexOf("%}", forStart);
    if (tagEnd === -1) break;
    const tag = result.substring(forStart, tagEnd + 2);
    const tagMatch = tag.match(/\{%[-\s]*for\s+(\w+)\s+in\s+(.+?)\s*[-]?%\}/);
    if (!tagMatch) break;

    const itemVar = tagMatch[1];
    const listExpr = tagMatch[2];

    // Find the matching endfor by counting nesting depth
    let depth = 1;
    let pos = tagEnd + 2;
    let endforStart = -1;
    let endforEnd = -1;
    while (depth > 0 && pos < result.length) {
      const nextFor = result.indexOf("{% for", pos);
      const nextEndfor = result.indexOf("{% endfor", pos);
      // Also check whitespace variants
      const nextEndfor2 = result.indexOf("{%- endfor", pos);
      const nextEndfor3 = result.indexOf("{%  endfor", pos);
      
      // Find earliest endfor variant
      let actualEndfor = nextEndfor;
      if (nextEndfor2 !== -1 && (actualEndfor === -1 || nextEndfor2 < actualEndfor)) actualEndfor = nextEndfor2;
      if (nextEndfor3 !== -1 && (actualEndfor === -1 || nextEndfor3 < actualEndfor)) actualEndfor = nextEndfor3;

      if (actualEndfor === -1) break;

      if (nextFor !== -1 && nextFor < actualEndfor) {
        depth++;
        pos = nextFor + 6;
      } else {
        depth--;
        if (depth === 0) {
          endforStart = actualEndfor;
          endforEnd = result.indexOf("%}", actualEndfor) + 2;
          break;
        }
        pos = actualEndfor + 10;
      }
    }

    if (endforStart === -1 || endforEnd === -1) break;

    const body = result.substring(tagEnd + 2, endforStart);
    const before = result.substring(0, forStart);
    const after = result.substring(endforEnd);

    const list = evalExpression(listExpr.trim(), data);
    if (!Array.isArray(list)) {
      result = before + after;
      continue;
    }

    const rendered = list
      .map((item, index) => {
        const loopData = {
          ...data,
          [itemVar]: item,
          loop: { index: index + 1, index0: index, first: index === 0, last: index === list.length - 1, length: list.length },
        };
        let itemRendered = processForLoops(body, loopData);
        itemRendered = processIfBlocks(itemRendered, loopData);
        itemRendered = itemRendered.replace(/\{\{(.+?)\}\}/g, (_m, expr) => {
          try {
            const val = evalExpression(expr.trim(), loopData);
            return val !== undefined && val !== null ? String(val) : "";
          } catch {
            return "";
          }
        });
        return itemRendered;
      })
      .join("");

    result = before + rendered + after;
  }

  return result;
}

function processIfBlocks(template: string, data: Record<string, any>): string {
  // Handle {% if %}...{% elif %}...{% else %}...{% endif %}
  const ifRegex = /\{%[-\s]*if\s+(.+?)\s*[-]?%\}([\s\S]*?)\{%[-\s]*endif\s*[-]?%\}/g;
  let result = template;
  let safety = 0;

  while (ifRegex.test(result) && safety < 30) {
    safety++;
    result = result.replace(ifRegex, (_match, condition, body) => {
      // Split on elif/else
      const parts = splitIfBody(body);

      for (const part of parts) {
        if (part.type === "if" || part.type === "elif") {
          const cond = part.type === "if" ? condition : part.condition;
          if (evalCondition(cond, data)) {
            return part.body;
          }
        } else if (part.type === "else") {
          return part.body;
        }
      }
      return "";
    });
    ifRegex.lastIndex = 0;
  }

  return result;
}

function splitIfBody(body: string): Array<{ type: string; condition?: string; body: string }> {
  const parts: Array<{ type: string; condition?: string; body: string }> = [];
  const regex = /\{%[-\s]*(elif|else)\s*(.*?)\s*[-]?%\}/g;
  let lastIndex = 0;
  let match;

  // First part is the "if" body
  const firstMatch = regex.exec(body);
  if (!firstMatch) {
    return [{ type: "if", body }];
  }

  parts.push({ type: "if", body: body.substring(0, firstMatch.index) });

  let currentType = firstMatch[1];
  let currentCondition = firstMatch[2] || undefined;
  lastIndex = firstMatch.index + firstMatch[0].length;

  while ((match = regex.exec(body)) !== null) {
    parts.push({ type: currentType, condition: currentCondition, body: body.substring(lastIndex, match.index) });
    currentType = match[1];
    currentCondition = match[2] || undefined;
    lastIndex = match.index + match[0].length;
  }

  parts.push({ type: currentType, condition: currentCondition, body: body.substring(lastIndex) });

  return parts;
}

function evalCondition(condition: string, data: Record<string, any>): boolean {
  const trimmed = condition.trim();

  // Handle "not" prefix
  if (trimmed.startsWith("not ")) {
    return !evalCondition(trimmed.substring(4), data);
  }

  // Handle "and"
  if (trimmed.includes(" and ")) {
    return trimmed.split(" and ").every((c) => evalCondition(c.trim(), data));
  }

  // Handle "or"
  if (trimmed.includes(" or ")) {
    return trimmed.split(" or ").some((c) => evalCondition(c.trim(), data));
  }

  // Handle comparisons
  const compMatch = trimmed.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (compMatch) {
    const left = evalExpression(compMatch[1].trim(), data);
    const right = evalExpression(compMatch[3].trim(), data);
    switch (compMatch[2]) {
      case "==": return left == right;
      case "!=": return left != right;
      case ">": return left > right;
      case "<": return left < right;
      case ">=": return left >= right;
      case "<=": return left <= right;
    }
  }

  // Truthiness check
  const val = evalExpression(trimmed, data);
  return !!val && val !== "" && val !== 0 && (!Array.isArray(val) || val.length > 0);
}

function evalExpression(expr: string, data: Record<string, any>): any {
  let trimmed = expr.trim();

  // Handle string literals
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // Handle numeric literals
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Handle filters: expr | filter(args)
  const filterMatch = trimmed.match(/^(.+?)\s*\|\s*(\w+)(?:\((.+?)\))?\s*$/);
  if (filterMatch) {
    const baseVal = evalExpression(filterMatch[1], data);
    const filterName = filterMatch[2];
    const filterArg = filterMatch[3];

    switch (filterName) {
      case "default":
        return baseVal !== undefined && baseVal !== null && baseVal !== ""
          ? baseVal
          : filterArg
            ? evalExpression(filterArg, data)
            : "";
      case "length":
        return Array.isArray(baseVal) ? baseVal.length : String(baseVal || "").length;
      case "string":
        return String(baseVal ?? "");
      case "safe":
        return baseVal;
      case "join":
        if (Array.isArray(baseVal)) {
          const sep = filterArg ? evalExpression(filterArg, data) : ",";
          return baseVal.join(String(sep));
        }
        return baseVal;
      default:
        return baseVal;
    }
  }

  // Handle dot notation and array access: a.b.c, a[0]
  const parts = trimmed.split(/\.|\[|\]/g).filter(Boolean);
  let val: any = data;
  for (const part of parts) {
    if (val === undefined || val === null) return undefined;
    val = val[part];
  }

  return val;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export function renderSlide(layoutId: string, slideData: Record<string, any>): string {
  const template = LAYOUT_TEMPLATES[layoutId] || LAYOUT_TEMPLATES["text-slide"];
  // Process inline markdown (**bold**, *italic*) in text fields
  const processedData = processSlideDataMarkdown(slideData);
  const content = renderTemplate(template, processedData);

  // Add slide footer with slide number and presentation title
  // Skip footer for title-slide and final-slide (they have their own branding)
  const skipFooter = layoutId === "title-slide" || layoutId === "final-slide";
  if (skipFooter) return content;

  const slideNum = slideData._slideNumber || (slideData._slide_index != null ? (slideData._slide_index + 1) : "");
  const totalSlides = slideData._totalSlides || "";
  const presTitle = slideData._presentationTitle || "";

  const footer = `<div class="slide-footer">
    <span class="slide-footer-title">${escapeHtml(String(presTitle))}</span>
    <span class="slide-footer-number">${slideNum}${totalSlides ? ` / ${totalSlides}` : ""}</span>
  </div>`;

  return content + footer;
}

export function renderPresentation(
  slides: Array<{ layoutId: string; data: Record<string, any>; html?: string }>,
  themeCss: string,
  presentationTitle: string,
  language: string = "ru",
  fontsUrl?: string,
): string {
  const renderedSlides = slides.map((slide, index) => {
    const html = slide.html || renderSlide(slide.layoutId, {
      ...slide.data,
      _slide_index: index,
      _slideNumber: index + 1,
      _totalSlides: slides.length,
      _presentationTitle: presentationTitle,
    });
    return html;
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
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
})();
`;
      }
    });
  }

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <title>${escapeHtml(presentationTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontsUrl || 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'}" rel="stylesheet" />
  <style>${BASE_CSS}</style>
  <style>${themeCss}</style>
  ${hasCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>' : ""}
  <style>
    body { margin: 0; padding: 40px 0; background: #1a1a2e; display: flex; flex-direction: column; align-items: center; gap: 40px; }
    .slide-container { position: relative; }
    .slide-number { position: absolute; top: -28px; left: 0; font-family: 'Inter', sans-serif; font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 500; }
  </style>
</head>
<body>
  ${renderedSlides
    .map(
      (html, i) => `<div class="slide-container">
    <div class="slide-number">Slide ${i + 1} / ${renderedSlides.length}</div>
    <div class="slide" style="width:1280px; height:720px; overflow:hidden; border-radius:4px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
      ${html}
    </div>
  </div>`,
    )
    .join("\n  ")}
  ${chartScripts ? `<script>${chartScripts}</script>` : ""}
</body>
</html>`;
}

export function getLayoutTemplate(layoutId: string): string {
  return LAYOUT_TEMPLATES[layoutId] || "";
}

export function listLayouts(): string[] {
  return Object.keys(LAYOUT_TEMPLATES);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
