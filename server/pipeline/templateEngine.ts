/**
 * Template Engine — renders slide HTML from layout templates + data.
 * Uses Nunjucks for Jinja2-compatible template rendering.
 * Templates are embedded as strings (ported from Python backend).
 */
import { processSlideDataMarkdown } from "./markdownInline";
import { autoDensity } from "./autoDensity";

// ═══════════════════════════════════════════════════════
// LAYOUT TEMPLATES (Jinja2/Nunjucks syntax)
// ═══════════════════════════════════════════════════════

const LAYOUT_TEMPLATES: Record<string, string> = {
  "title-slide": `<div class="bspb-title-slide" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
  <!-- Full-bleed background photo -->
  <div style="position: absolute; inset: 0; z-index: 1;">
    <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663124868360/axBJgpxbruLZDqPX.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover;" />
  </div>
  <!-- Blue panel (bottom-left) -->
  <div style="position: absolute; left: 0; top: 44%; bottom: 0; width: 49%; background: rgba(0,87,171,0.9); z-index: 2;"></div>
  <!-- BSPB Logo (top-left) -->
  <div style="position: absolute; top: 55px; left: 56px; z-index: 10;">
    <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663124868360/YgWUGGIfCqwHIQEd.png" alt="БСПБ" style="height: 53px; width: auto;" />
  </div>
  <!-- Red decorative line (top-right) -->
  <div style="position: absolute; top: 100px; right: 100px; z-index: 10;">
    <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663124868360/xPDYGlxYLgYvmYKL.png" alt="" style="width: 220px; height: auto;" />
  </div>
  <!-- Content on blue panel -->
  <div style="position: absolute; left: 56px; top: 44%; bottom: 0; width: calc(49% - 56px); z-index: 5; display: flex; flex-direction: column; justify-content: center; padding-right: 40px;">
    <h1 style="color: #ffffff; font-family: Arial, sans-serif; font-size: 38px; font-weight: 700; line-height: 1.15; margin: 0 0 14px 0;">{{ title }}</h1>
    <!-- Red underline brush stroke -->
    <div style="margin-bottom: 24px;">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663124868360/xPDYGlxYLgYvmYKL.png" alt="" style="width: 200px; height: auto;" />
    </div>
    {% if description %}
    <p style="color: rgba(255,255,255,0.9); font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">{{ description }}</p>
    {% endif %}
    {% if presentationDate %}
    <p style="color: rgba(255,255,255,0.7); font-family: Arial, sans-serif; font-size: 11px; margin: 0; position: absolute; bottom: 20px; left: 0;">{{ presentationDate | default('') }}</p>
    {% endif %}
  </div>
</div>`,

  "section-header": `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 0 64px; text-align: center; background: var(--slide-bg-accent-gradient, var(--primary-accent-color)); position: relative; overflow: hidden;">
  <div style="position: absolute; top: -120px; right: -120px; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,0.06); pointer-events: none;"></div>
  <div style="position: absolute; bottom: -80px; left: -80px; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none;"></div>
  <div style="position: absolute; top: 50%; left: 10%; width: 150px; height: 150px; border-radius: 50%; background: rgba(255,255,255,0.03); pointer-events: none; transform: translateY(-50%);"></div>
  <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; max-width: 900px;">
    <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.4); border-radius: 2px; margin-bottom: 32px;"></div>
    <h1 style="color: #ffffff; letter-spacing: -0.02em; font-size: 52px; font-weight: 700; line-height: 1.1; margin: 0 0 24px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ title }}</h1>
    {% if subtitle %}
    <p style="color: rgba(255,255,255,0.85); max-width: 640px; font-size: 20px; line-height: 1.5; margin: 0;">{{ subtitle }}</p>
    {% endif %}
    <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.4); border-radius: 2px; margin-top: 32px;"></div>
  </div>
</div>`,

  "text-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; display: flex; align-items: center; gap: var(--at-gap, 16px); margin-bottom: 16px;">
    {% if icon and icon.url %}
    <div class="icon-circle" style="width: var(--at-icon-size, 48px); height: var(--at-icon-size, 48px);"><img src="{{ icon.url }}" alt="{{ icon.name | default('') }}" /></div>
    {% endif %}
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
  </div>
  <div class="accent-line" style="flex-shrink: 0; margin-bottom: 20px;"></div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
    <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 12px);">
      {% for bullet in bullets | default([]) %}
      <div class="bullet-row" style="padding: var(--at-gap-sm, 12px) var(--at-gap, 16px);">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: var(--at-body-size, 16px); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.description | default('') }}</div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "two-column": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--at-gap, 24px); width: 100%; align-items: start;">
      <div class="card" style="display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
        <h2 style="color: var(--text-heading-color, #111827); font-size: var(--at-subtitle-size, 20px); font-weight: 600; margin: 0 0 12px 0; flex-shrink: 0;">{{ leftColumn.title | default('') }}</h2>
        <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px); overflow: hidden;">
          {% for bullet in leftColumn.bullets | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 3); -webkit-box-orient: vertical;">{{ bullet }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
      <div class="card" style="display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
        <h2 style="color: var(--text-heading-color, #111827); font-size: var(--at-subtitle-size, 20px); font-weight: 600; margin: 0 0 12px 0; flex-shrink: 0;">{{ rightColumn.title | default('') }}</h2>
        <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px); overflow: hidden;">
          {% for bullet in rightColumn.bullets | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: var(--secondary-accent-color, #3b82f6);"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 3); -webkit-box-orient: vertical;">{{ bullet }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
    </div>
  </div>
</div>`,

  "image-text": `<div style="display: flex; height: 100%; padding: 36px 48px; gap: 24px; overflow: hidden;">
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
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 32px); font-weight: 700; line-height: var(--at-title-lh, 1.15); margin: 0 0 12px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-bottom: 16px;"></div>
    <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 12px);">
      {% for bullet in bullets | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: var(--at-small-size, 15px); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); line-height: var(--at-body-lh, 1.5); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.description | default('') }}</div>
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
    <h1 style="color: #ffffff; font-size: 42px; font-weight: 700; line-height: 1.15; margin: 0 0 16px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ title }}</h1>
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
    <blockquote style="color: #ffffff; font-size: 28px; line-height: 1.5; max-width: 768px; margin: 0 0 24px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical;">{{ quote }}</blockquote>
    <div class="accent-line-center" style="margin-bottom: 16px;"></div>
    <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0;">{{ author | default('') }}</p>
    {% if role %}
    <p style="color: rgba(255,255,255,0.7); font-size: 16px; margin: 4px 0 0 0;">{{ role }}</p>
    {% endif %}
  </div>
</div>`,

  "chart-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 16px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.5; margin: 12px 0 0 0;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 10px;">
    {% if chartSvg %}
    <div style="width: 100%; max-width: 700px; max-height: 100%;">{{{ chartSvg }}}</div>
    {% else %}
    <canvas id="chart-{{ _slide_index | default(0) }}" style="max-width: 100%; max-height: 100%;"></canvas>
    {% endif %}
  </div>
</div>`,

  "table-slide": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 16px); line-height: var(--at-body-lh, 1.5); margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: flex-start; overflow: hidden;">
    <div style="width: 100%; border-radius: 16px; overflow: auto; border: 1px solid var(--card-border-color, #e5e7eb); max-height: 100%;">
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
{% set cols = m_count if m_count <= 3 else 3 %}
{% set rows = ((m_count + cols - 1) / cols) | int %}
<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 30px); font-weight: 700; line-height: var(--at-title-lh, 1.2); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 10px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; justify-content: center; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat({{ cols }}, 1fr); gap: var(--at-gap, 14px); width: 100%; max-width: 1000px; max-height: 100%; overflow: hidden;">
      {% for metric in metrics | default([]) %}
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--at-gap-sm, 6px); min-width: 0; min-height: 0; overflow: hidden; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08)); border-radius: 12px; padding: var(--at-card-padding, 14px) 10px; box-shadow: var(--card-shadow, 0 2px 12px rgba(0,0,0,0.06));">
        {% if metric.icon and metric.icon.url %}
        <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="{{ metric.icon.url }}" alt="" style="width: 16px; height: 16px; filter: brightness(0) saturate(100%);" />
        </div>
        {% else %}
        <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: var(--primary-accent-color, #9333ea); font-size: 14px; font-weight: 700;">{{ forloop.counter }}</span>
        </div>
        {% endif %}
        <div style="color: var(--text-heading-color, #111827); font-size: var(--at-value-size, 26px); font-weight: 700; line-height: 1.1; flex-shrink: 0;">{{ metric.value }}</div>
        <div style="color: var(--primary-accent-color, #9333ea); font-size: var(--at-tiny-size, 11px); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;">{{ metric.label }}</div>
        {% if metric.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 11px); line-height: 1.3; max-width: 200px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ metric.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "timeline": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="position: relative; width: 100%;">
      <div style="position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: var(--primary-accent-color, #9333ea); opacity: 0.3;"></div>
      <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 14px);">
        {% for event in events | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: var(--at-gap, 16px); padding-left: 8px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); flex-shrink: 0; display: flex; align-items: center; justify-content: center; z-index: 1;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: white;"></div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="color: var(--primary-accent-color, #9333ea); font-size: var(--at-tiny-size, 12px); font-weight: 600; margin-bottom: 2px;">{{ event.date | default('') }}</div>
            <div style="color: var(--text-heading-color, #111827); font-size: var(--at-body-size, 16px); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ event.title }}</div>
            {% if event.description %}
            <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ event.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "process-steps": `{% set s_count = steps | default([]) | length %}{% set s_cols = s_count if s_count <= 5 else 5 %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat({{ s_cols }}, 1fr); gap: var(--at-gap, 16px); width: 100%;">
      {% for step in steps | default([]) %}
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--at-gap-sm, 8px);">
        <div style="width: var(--at-icon-size, 48px); height: var(--at-icon-size, 48px); border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: white; font-size: var(--at-icon-font, 20px); font-weight: 700;">{{ step.number | default(loop.index) }}</span>
        </div>
        <div style="color: var(--text-heading-color, #111827); font-size: var(--at-small-size, 15px); font-weight: 600; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ step.title }}</div>
        {% if step.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 12px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 3); -webkit-box-orient: vertical;">{{ step.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "comparison": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--at-gap, 24px); width: 100%; align-items: start;">
      <div class="card" style="border-left: 4px solid {{ optionA.color | default('#22c55e') }}; display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
        <h2 style="color: var(--text-heading-color, #111827); font-size: var(--at-subtitle-size, 20px); font-weight: 600; margin: 0 0 12px 0; flex-shrink: 0;">{{ optionA.title | default('Option A') }}</h2>
        <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px); overflow: hidden;">
          {% for point in optionA.points | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: {{ optionA.color | default('#22c55e') }};"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ point }}</span>
          </div>
          {% endfor %}
        </div>
      </div>
      <div class="card" style="border-left: 4px solid {{ optionB.color | default('#ef4444') }}; display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
        <h2 style="color: var(--text-heading-color, #111827); font-size: var(--at-subtitle-size, 20px); font-weight: 600; margin: 0 0 12px 0; flex-shrink: 0;">{{ optionB.title | default('Option B') }}</h2>
        <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px); overflow: hidden;">
          {% for point in optionB.points | default([]) %}
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: {{ optionB.color | default('#ef4444') }};"></div>
            <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ point }}</span>
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
    <h1 style="color: #ffffff; font-size: 52px; font-weight: 700; line-height: 1.05; margin: 0 0 16px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ title | default('Спасибо!') }}</h1>
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

  "agenda-table-of-contents": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
    <div style="display: flex; flex-direction: column; gap: 10px;">
      {% for section in sections | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: var(--at-gap, 16px); padding: var(--at-gap-sm, 10px) 14px; border-radius: 10px; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 5%, white);">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: white; font-weight: 700; font-size: var(--at-small-size, 14px);">{{ section.number | default(loop.index) }}</span>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-size: var(--at-small-size, 15px); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ section.title }}</div>
          {% if section.description %}
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 1); -webkit-box-orient: vertical;">{{ section.description }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "team-profiles": `{% set t_count = teamMembers | default([]) | length %}{% set t_cols = t_count if t_count <= 5 else 5 %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if companyDescription %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 15px; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ companyDescription }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat({{ t_cols }}, 1fr); gap: 16px; width: 100%;">
      {% for member in teamMembers | default([]) %}
      <div class="card" style="text-align: center; padding: var(--at-card-padding, 16px) 12px; overflow: hidden;">
        <div style="width: var(--at-icon-size, 64px); height: var(--at-icon-size, 64px); border-radius: 50%; margin: 0 auto 8px; overflow: hidden; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, white);">
          {% if member.image and member.image.url %}
          <img src="{{ member.image.url }}" alt="{{ member.name }}" style="width: 100%; height: 100%; object-fit: cover;" />
          {% else %}
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--primary-accent-color, #9333ea);">{{ member.name[0] | default('?') }}</div>
          {% endif %}
        </div>
        <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ member.name }}</div>
        <div style="color: var(--primary-accent-color, #9333ea); font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ member.role | default('') }}</div>
        {% if member.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 11px; margin-top: 6px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">{{ member.description }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "logo-grid": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 16px; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
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

  "video-embed": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
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

  "waterfall-chart": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: flex-end; gap: 4px; padding-bottom: 32px; overflow: hidden;">
    {% for bar in bars | default([]) %}
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0;">
      <div style="font-size: 13px; font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">{{ bar.value | default('') }}</div>
      <div style="width: 100%; height: {{ bar.height | default('50') }}%; min-height: 24px; border-radius: 8px 8px 0 0; background: {{ bar.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative; display: flex; align-items: center; justify-content: center;">
        {% if bar.change %}
        <span style="font-size: 11px; font-weight: 600; color: white;">{{ bar.change }}</span>
        {% endif %}
      </div>
      <div style="font-size: 11px; color: var(--text-body-color, #4b5563); text-align: center; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">{{ bar.label | default('') }}</div>
    </div>
    {% endfor %}
  </div>
</div>`,

  "swot-analysis": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px;">
    <div style="border-radius: 12px; padding: 16px; background: color-mix(in srgb, #22c55e 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #22c55e 20%, transparent); display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0;">
        <div style="width: 28px; height: 28px; border-radius: 6px; background: #22c55e; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <h2 style="color: #16a34a; font-size: 15px; font-weight: 700; margin: 0;">{{ strengths.title | default('Strengths') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
        {% for item in strengths.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: #22c55e;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 12px; padding: var(--at-card-padding, 16px); background: color-mix(in srgb, #ef4444 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #ef4444 20%, transparent); display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0;">
        <div style="width: 28px; height: 28px; border-radius: 6px; background: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 style="color: #dc2626; font-size: var(--at-small-size, 15px); font-weight: 700; margin: 0;">{{ weaknesses.title | default('Weaknesses') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
        {% for item in weaknesses.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: #ef4444;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 12px; padding: var(--at-card-padding, 16px); background: color-mix(in srgb, #3b82f6 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #3b82f6 20%, transparent); display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0;">
        <div style="width: 28px; height: 28px; border-radius: 6px; background: #3b82f6; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h2 style="color: #2563eb; font-size: var(--at-small-size, 15px); font-weight: 700; margin: 0;">{{ opportunities.title | default('Opportunities') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
        {% for item in opportunities.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: #3b82f6;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="border-radius: 12px; padding: var(--at-card-padding, 16px); background: color-mix(in srgb, #f59e0b 8%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, #f59e0b 20%, transparent); display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0;">
        <div style="width: 28px; height: 28px; border-radius: 6px; background: #f59e0b; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
        </div>
        <h2 style="color: #d97706; font-size: var(--at-small-size, 15px); font-weight: 700; margin: 0;">{{ threats.title | default('Threats') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
        {% for item in threats.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: #f59e0b;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-label-size, 13px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "funnel": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; overflow: hidden;">
    {% for stage in stages | default([]) %}
    {% set widthPercent = 100 - (loop.index0 * (60 / (stages | length))) %}
    <div style="width: {{ widthPercent }}%; display: flex; align-items: center; border-radius: 10px; padding: 10px 20px; background: {{ stage.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative; min-height: 44px;">
      <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
        <div style="font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.9); min-width: 50px;">{{ stage.value | default('') }}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ stage.title | default('') }}</div>
          {% if stage.description %}
          <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ stage.description }}</div>
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

  "roadmap": `{% set m_count = milestones | default([]) | length %}{% set m_cols = m_count if m_count <= 5 else 5 %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 16px; line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="width: 100%; position: relative;">
      <div style="position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 20%, transparent); border-radius: 2px; transform: translateY(-50%);"></div>
      <div style="display: grid; grid-template-columns: repeat({{ m_cols }}, 1fr); gap: 12px; position: relative;">
        {% for milestone in milestones | default([]) %}
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          {% if loop.index0 % 2 == 0 %}
          <div style="margin-bottom: 8px; min-height: 70px; display: flex; flex-direction: column; justify-content: flex-end;">
            <div style="font-size: 11px; font-weight: 600; color: var(--primary-accent-color, #9333ea); text-transform: uppercase; letter-spacing: 0.05em;">{{ milestone.date | default('') }}</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-heading-color, #111827); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ milestone.title }}</div>
            {% if milestone.description %}
            <div style="font-size: 11px; color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ milestone.description }}</div>
            {% endif %}
          </div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; border: 3px solid var(--card-background-color, #ffffff); box-shadow: 0 0 0 2px {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; z-index: 2; flex-shrink: 0;"></div>
          <div style="min-height: 70px;"></div>
          {% else %}
          <div style="min-height: 70px;"></div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; border: 3px solid var(--card-background-color, #ffffff); box-shadow: 0 0 0 2px {{ milestone.color | default('var(--primary-accent-color, #9333ea)') }}; z-index: 2; flex-shrink: 0;"></div>
          <div style="margin-top: 8px; min-height: 70px; display: flex; flex-direction: column;">
            <div style="font-size: 11px; font-weight: 600; color: var(--primary-accent-color, #9333ea); text-transform: uppercase; letter-spacing: 0.05em;">{{ milestone.date | default('') }}</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-heading-color, #111827); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ milestone.title }}</div>
            {% if milestone.description %}
            <div style="font-size: 11px; color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ milestone.description }}</div>
            {% endif %}
          </div>
          {% endif %}
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "pyramid": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
    <div style="display: flex; width: 100%; max-width: 1000px; gap: 24px;">
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
        {% for level in levels | default([]) %}
        {% set widthPercent = 30 + (loop.index0 * (70 / (levels | length))) %}
        <div style="width: {{ widthPercent }}%; padding: 12px 16px; text-align: center; border-radius: 6px; background: {{ level.color | default('var(--primary-accent-color, #9333ea)') }}; position: relative;">
          <div style="font-size: 13px; font-weight: 600; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ level.title | default('') }}</div>
        </div>
        {% endfor %}
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px; overflow: hidden;">
        {% for level in levels | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: {{ level.color | default('var(--primary-accent-color, #9333ea)') }};"></div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ level.title | default('') }}</div>
            {% if level.description %}
            <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ level.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "matrix-2x2": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
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
        <div style="border-radius: 10px; padding: 14px; background: {{ quadrant.color | default('color-mix(in srgb, var(--primary-accent-color, #9333ea) 6%, var(--card-background-color, #ffffff))') }}; display: flex; flex-direction: column; overflow: hidden;">
          <div style="font-size: 14px; font-weight: 700; color: var(--text-heading-color, #111827); margin-bottom: 6px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ quadrant.title | default('') }}</div>
          {% if quadrant.description %}
          <div style="font-size: 12px; color: var(--text-body-color, #4b5563); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ quadrant.description }}</div>
          {% endif %}
          {% if quadrant.items %}
          <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 6px; overflow: hidden;">
            {% for item in quadrant.items %}
            <div style="font-size: 11px; color: var(--text-body-color, #4b5563); display: flex; align-items: center; gap: 5px;">
              <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); flex-shrink: 0;"></div>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ item }}</span>
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

  "pros-cons": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; text-align: center; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line-center" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
   <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--at-gap, 24px); align-items: start; width: 100%;">
    <div class="card" style="border-top: 4px solid #22c55e; display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-shrink: 0;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style="color: #16a34a; font-size: var(--at-subtitle-size, 18px); font-weight: 700; margin: 0;">{{ pros.title | default('Advantages') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; overflow: hidden;">
        {% for item in pros.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: color-mix(in srgb, #22c55e 15%, transparent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div class="card" style="border-top: 4px solid #ef4444; display: flex; flex-direction: column; overflow: hidden; padding: var(--at-card-padding, 24px);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-shrink: 0;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <h2 style="color: #dc2626; font-size: var(--at-subtitle-size, 18px); font-weight: 700; margin: 0;">{{ cons.title | default('Disadvantages') }}</h2>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; overflow: hidden;">
        {% for item in cons.items | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background: color-mix(in srgb, #ef4444 15%, transparent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 14px); line-height: var(--at-body-lh, 1.5); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ item }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
   </div>
  </div>
</div>`,

  "checklist": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 15px; line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%;">
      {% for item in items | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 10px; padding: var(--at-gap-sm, 10px) 12px; border-radius: 10px; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08)); box-shadow: var(--card-shadow, 0 2px 8px rgba(0,0,0,0.04));">
        {% if item.done %}
        <div style="width: 20px; height: 20px; border-radius: 5px; background: #22c55e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        {% else %}
        <div style="width: 20px; height: 20px; border-radius: 5px; border: 2px solid var(--card-border-color, #d1d5db); flex-shrink: 0; margin-top: 1px;"></div>
        {% endif %}
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-heading-color, #111827); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;{% if item.done %} text-decoration: line-through; opacity: 0.6;{% endif %}">{{ item.title | default('') }}</div>
          {% if item.description %}
          <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ item.description }}</div>
          {% endif %}
        </div>
        {% if item.status %}
        <div style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 20px; background: {{ item.statusColor | default('color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, transparent)') }}; color: {{ item.statusTextColor | default('var(--primary-accent-color, #9333ea)') }}; white-space: nowrap; flex-shrink: 0;">{{ item.status }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "highlight-stats": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; border-radius: 16px; background: var(--slide-bg-accent-gradient, var(--primary-accent-color, #9333ea)); text-align: center;">
        <div style="font-size: 56px; font-weight: 800; color: #ffffff; line-height: 1;">{{ mainStat.value | default('') }}</div>
        <div style="font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.9); margin-top: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">{{ mainStat.label | default('') }}</div>
        {% if mainStat.description %}
        <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ mainStat.description }}</div>
        {% endif %}
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; justify-content: center; overflow: hidden;">
        {% for stat in supportingStats | default([]) %}
        <div class="card" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px;">
          <div style="font-size: 28px; font-weight: 700; color: var(--primary-accent-color, #9333ea); min-width: 70px;">{{ stat.value | default('') }}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ stat.label | default('') }}</div>
            {% if stat.description %}
            <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ stat.description }}</div>
            {% endif %}
          </div>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  // ═══════════════════════════════════════════════════════
  // MANUS-STYLE LAYOUTS (Sprint 4)
  // ═══════════════════════════════════════════════════════

  "stats-chart": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; overflow: hidden;">
    <div style="display: flex; flex-direction: column; gap: 12px; justify-content: center; overflow: hidden;">
      {% for stat in stats | default([]) %}
      <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 16px 20px;">
        <div style="min-width: 80px;">
          <div style="font-size: var(--at-value-size, 28px); font-weight: 700; color: var(--primary-accent-color, #6366f1); line-height: 1;">{{ stat.value | default('') }}</div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: var(--at-small-size, 14px); font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ stat.label | default('') }}</div>
          {% if stat.description %}
          <div style="font-size: var(--at-tiny-size, 12px); color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ stat.description }}</div>
          {% endif %}
        </div>
        {% if stat.change %}
        <div style="font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 12px; white-space: nowrap; {% if stat.changeDirection == 'up' %}color: #16a34a; background: rgba(22,163,74,0.1);{% elif stat.changeDirection == 'down' %}color: #dc2626; background: rgba(220,38,38,0.1);{% else %}color: var(--text-body-color); background: rgba(0,0,0,0.05);{% endif %}">{{ stat.change }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
    <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">
      {% if chartSvg %}
      <div style="width: 100%; max-height: 100%;">{{{ chartSvg }}}</div>
      {% elif chartPlaceholder %}
      <div class="card" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px;">
        <div style="text-align: center; color: var(--text-body-color, #4b5563);">
          <div style="font-size: 48px; margin-bottom: 8px; opacity: 0.3;">📊</div>
          <div style="font-size: 14px;">{{ chartPlaceholder }}</div>
        </div>
      </div>
      {% endif %}
    </div>
  </div>
  {% if source %}
  <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
  </div>
  {% endif %}
</div>`,

  "chart-text": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; overflow: hidden;">
    <div style="display: flex; align-items: center; justify-content: center; overflow: hidden;">
      {% if chartSvg %}
      <div style="width: 100%; max-height: 100%;">{{{ chartSvg }}}</div>
      {% elif chartPlaceholder %}
      <div class="card" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px;">
        <div style="text-align: center; color: var(--text-body-color, #4b5563);">
          <div style="font-size: 48px; margin-bottom: 8px; opacity: 0.3;">📊</div>
          <div style="font-size: 14px;">{{ chartPlaceholder }}</div>
        </div>
      </div>
      {% endif %}
    </div>
    <div style="display: flex; flex-direction: column; justify-content: center; gap: var(--at-gap-sm, 12px); overflow: hidden;">
      {% if description %}
      <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: var(--at-body-lh, 1.5); margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">{{ description }}</p>
      {% endif %}
      {% for bullet in bullets | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="width: 6px; height: 6px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #6366f1);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: var(--at-small-size, 14px); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ bullet.title | default('') }}</div>
          {% if bullet.description %}
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 12px); line-height: 1.4; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.description }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
  {% if source %}
  <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
  </div>
  {% endif %}
</div>`,

  "hero-stat": `<div style="display: flex; height: 100%; overflow: hidden;">
  <div style="width: 45%; background: var(--slide-bg-accent-gradient, var(--primary-accent-color, #6366f1)); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; position: relative; overflow: hidden;">
    <div style="position: absolute; top: -80px; right: -80px; width: 250px; height: 250px; border-radius: 50%; background: rgba(255,255,255,0.06); pointer-events: none;"></div>
    <div style="position: absolute; bottom: -60px; left: -60px; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none;"></div>
    <div style="position: relative; z-index: 10; text-align: center;">
      <div style="font-size: 72px; font-weight: 800; color: #ffffff; line-height: 1; letter-spacing: -0.02em;">{{ mainStat.value | default('') }}</div>
      <div style="font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.9); margin-top: 12px;">{{ mainStat.label | default('') }}</div>
      {% if mainStat.description %}
      <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 8px; max-width: 280px;">{{ mainStat.description }}</div>
      {% endif %}
    </div>
  </div>
  <div style="flex: 1; display: flex; flex-direction: column; padding: 36px 48px 32px; overflow: hidden;">
    <div style="flex-shrink: 0; margin-bottom: 20px;">
      <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 32px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
      <div class="accent-line" style="margin-top: 12px;"></div>
    </div>
    <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; overflow: hidden;">
      {% for stat in supportingStats | default([]) %}
      <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 16px 20px;">
        <div style="font-size: 24px; font-weight: 700; color: var(--primary-accent-color, #6366f1); min-width: 70px;">{{ stat.value | default('') }}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ stat.label | default('') }}</div>
          {% if stat.description %}
          <div style="font-size: 12px; color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ stat.description }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
    {% if callout %}
    <div style="flex-shrink: 0; margin-top: 12px; padding: 12px 16px; border-radius: 10px; background: color-mix(in srgb, var(--primary-accent-color, #6366f1) 6%, white); border-left: 3px solid var(--primary-accent-color, #6366f1);">
      <div style="font-size: 12px; color: var(--text-body-color, #4b5563);">{{ callout }}</div>
    </div>
    {% endif %}
  </div>
</div>`,

  "scenario-cards": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: repeat({{ scenarios | default([]) | length }}, 1fr); gap: 16px; overflow: hidden;">
    {% for scenario in scenarios | default([]) %}
    <div class="card" style="display: flex; flex-direction: column; padding: 20px; overflow: hidden; border-top: 4px solid {{ scenario.color | default('var(--primary-accent-color, #6366f1)') }};">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: {{ scenario.color | default('var(--primary-accent-color, #6366f1)') }}; margin-bottom: 8px;">{{ scenario.label | default('') }}</div>
      <div style="font-size: var(--at-subtitle-size, 18px); font-weight: 700; color: var(--text-heading-color, #111827); margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ scenario.title | default('') }}</div>
      {% if scenario.value %}
      <div style="font-size: 28px; font-weight: 800; color: {{ scenario.color | default('var(--primary-accent-color, #6366f1)') }}; margin-bottom: 8px;">{{ scenario.value }}</div>
      {% endif %}
      <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: hidden;">
        {% for point in scenario.points | default([]) %}
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <div style="width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: {{ scenario.color | default('var(--primary-accent-color, #6366f1)') }}; opacity: 0.5;"></div>
          <span style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 12px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ point }}</span>
        </div>
        {% endfor %}
      </div>
      {% if scenario.probability %}
      <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
        <div style="font-size: 11px; color: var(--text-body-color, #4b5563);">Вероятность: <strong style="color: {{ scenario.color | default('var(--primary-accent-color)') }};">{{ scenario.probability }}</strong></div>
      </div>
      {% endif %}
    </div>
    {% endfor %}
  </div>
</div>`,

  "numbered-steps-v2": `{% set s2_count = steps | default([]) | length %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; overflow: hidden;">
    {% for step in steps | default([]) %}
    <div style="display: flex; align-items: flex-start; gap: 20px;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: {% if loop.index == 1 %}var(--primary-accent-color, #6366f1){% else %}color-mix(in srgb, var(--primary-accent-color, #6366f1) 12%, white){% endif %}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 18px; font-weight: 700; color: {% if loop.index == 1 %}#ffffff{% else %}var(--primary-accent-color, #6366f1){% endif %};">{{ step.number | default(loop.index) }}</span>
      </div>
      <div style="flex: 1; min-width: 0; padding-top: 4px;">
        <div style="font-size: var(--at-body-size, 16px); font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ step.title | default('') }}</div>
        {% if step.description %}
        <div style="font-size: var(--at-small-size, 13px); color: var(--text-body-color, #4b5563); margin-top: 4px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ step.description }}</div>
        {% endif %}
      </div>
      {% if step.result %}
      <div style="flex-shrink: 0; padding: 6px 14px; border-radius: 8px; background: color-mix(in srgb, var(--primary-accent-color, #6366f1) 8%, white); font-size: 12px; font-weight: 600; color: var(--primary-accent-color, #6366f1); white-space: nowrap;">{{ step.result }}</div>
      {% endif %}
    </div>
    {% if not loop.last %}
    <div style="margin-left: 24px; width: 1px; height: 8px; background: var(--card-border-color, rgba(0,0,0,0.1));"></div>
    {% endif %}
    {% endfor %}
  </div>
</div>`,

  "timeline-horizontal": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 20px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
    <div style="position: relative; padding: 0 20px;">
      <div style="position: absolute; left: 20px; right: 20px; top: 50%; height: 3px; background: linear-gradient(90deg, var(--primary-accent-color, #6366f1), var(--primary-accent-light, rgba(99,102,241,0.3))); border-radius: 2px;"></div>
      <div style="display: grid; grid-template-columns: repeat({{ events | default([]) | length }}, 1fr); gap: 8px; position: relative;">
        {% for event in events | default([]) %}
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          {% if loop.index % 2 == 1 %}
          <div style="margin-bottom: 12px; min-height: 80px; display: flex; flex-direction: column; justify-content: flex-end;">
            <div style="font-size: var(--at-small-size, 13px); font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ event.title | default('') }}</div>
            {% if event.description %}
            <div style="font-size: var(--at-tiny-size, 11px); color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ event.description }}</div>
            {% endif %}
          </div>
          {% endif %}
          <div style="width: 14px; height: 14px; border-radius: 50%; background: {% if event.highlight %}var(--primary-accent-color, #6366f1){% else %}#ffffff{% endif %}; border: 3px solid var(--primary-accent-color, #6366f1); flex-shrink: 0; z-index: 1;"></div>
          <div style="font-size: 11px; font-weight: 600; color: var(--primary-accent-color, #6366f1); margin-top: 6px; margin-bottom: 6px;">{{ event.date | default('') }}</div>
          {% if loop.index % 2 == 0 %}
          <div style="min-height: 80px;">
            <div style="font-size: var(--at-small-size, 13px); font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">{{ event.title | default('') }}</div>
            {% if event.description %}
            <div style="font-size: var(--at-tiny-size, 11px); color: var(--text-body-color, #4b5563); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ event.description }}</div>
            {% endif %}
          </div>
          {% endif %}
        </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>`,

  "text-with-callout": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; display: flex; align-items: center; gap: var(--at-gap, 16px); margin-bottom: 16px;">
    {% if icon and icon.url %}
    <div class="icon-circle" style="width: var(--at-icon-size, 48px); height: var(--at-icon-size, 48px);"><img src="{{ icon.url }}" alt="{{ icon.name | default('') }}" /></div>
    {% endif %}
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
  </div>
  <div class="accent-line" style="flex-shrink: 0; margin-bottom: 16px;"></div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
    <div style="display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px);">
      {% for bullet in bullets | default([]) %}
      <div class="bullet-row" style="padding: var(--at-gap-sm, 10px) var(--at-gap, 16px);">
        <div style="width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; background: var(--primary-accent-color, #9333ea);"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: var(--text-heading-color, #111827); font-weight: 600; font-size: var(--at-body-size, 15px); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-bullet-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-small-size, 13px); line-height: var(--at-body-lh, 1.5); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ bullet.description | default('') }}</div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
  {% if callout %}
  <div style="flex-shrink: 0; margin-top: 12px; padding: 14px 20px; border-radius: 12px; background: color-mix(in srgb, var(--primary-accent-color, #6366f1) 6%, white); border-left: 4px solid var(--primary-accent-color, #6366f1);">
    <div style="font-size: 13px; font-weight: 500; color: var(--text-heading-color, #111827); line-height: 1.4;">{{ callout }}</div>
  </div>
  {% endif %}
  {% if source %}
  <div style="flex-shrink: 0; margin-top: 6px;">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
  </div>
  {% endif %}
</div>`,

  "dual-chart": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; overflow: hidden;">
    <div class="card" style="display: flex; flex-direction: column; padding: 20px; overflow: hidden;">
      <div style="flex-shrink: 0; margin-bottom: 12px;">
        <div style="font-size: var(--at-small-size, 14px); font-weight: 700; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ leftChart.title | default('') }}</div>
        {% if leftChart.subtitle %}
        <div style="font-size: var(--at-tiny-size, 12px); color: var(--text-body-color, #4b5563); margin-top: 2px;">{{ leftChart.subtitle }}</div>
        {% endif %}
      </div>
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden;">
        {% if leftChartSvg %}
        <div style="width: 100%; max-height: 100%;">{{{ leftChartSvg }}}</div>
        {% elif leftChart.placeholder %}
        <div style="text-align: center; color: var(--text-body-color, #4b5563);">
          <div style="font-size: 40px; margin-bottom: 8px; opacity: 0.3;">📊</div>
          <div style="font-size: 12px;">{{ leftChart.placeholder }}</div>
        </div>
        {% endif %}
      </div>
      {% if leftChart.insight %}
      <div style="flex-shrink: 0; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
        <div style="font-size: 11px; color: var(--text-body-color, #4b5563); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">💡 {{ leftChart.insight }}</div>
      </div>
      {% endif %}
    </div>
    <div class="card" style="display: flex; flex-direction: column; padding: 20px; overflow: hidden;">
      <div style="flex-shrink: 0; margin-bottom: 12px;">
        <div style="font-size: var(--at-small-size, 14px); font-weight: 700; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ rightChart.title | default('') }}</div>
        {% if rightChart.subtitle %}
        <div style="font-size: var(--at-tiny-size, 12px); color: var(--text-body-color, #4b5563); margin-top: 2px;">{{ rightChart.subtitle }}</div>
        {% endif %}
      </div>
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden;">
        {% if rightChartSvg %}
        <div style="width: 100%; max-height: 100%;">{{{ rightChartSvg }}}</div>
        {% elif rightChart.placeholder %}
        <div style="text-align: center; color: var(--text-body-color, #4b5563);">
          <div style="font-size: 40px; margin-bottom: 8px; opacity: 0.3;">📊</div>
          <div style="font-size: 12px;">{{ rightChart.placeholder }}</div>
        </div>
        {% endif %}
      </div>
      {% if rightChart.insight %}
      <div style="flex-shrink: 0; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
        <div style="font-size: 11px; color: var(--text-body-color, #4b5563); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">💡 {{ rightChart.insight }}</div>
      </div>
      {% endif %}
    </div>
  </div>
  {% if source %}
  <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
  </div>
  {% endif %}
</div>`,

  "risk-matrix": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 14px); line-height: 1.5; margin: 6px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; overflow: hidden;">
    <div style="display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; margin-bottom: 4px;">
        <div style="width: 28px;"></div>
        {% for col in matrixColumns | default([]) %}
        <div style="flex: 1; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-body-color, #4b5563); padding: 4px 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ col }}</div>
        {% endfor %}
      </div>
      {% for row in matrixRows | default([]) %}
      <div style="display: flex; flex: 1; min-height: 0;">
        <div style="width: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-body-color, #4b5563); writing-mode: vertical-lr; transform: rotate(180deg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ row.label | default('') }}</div>
        </div>
        {% for cell in row.cells | default([]) %}
        <div style="flex: 1; margin: 2px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 4px; background: {{ cell.color | default('rgba(0,0,0,0.04)') }}; overflow: hidden;">
          <div style="font-size: 11px; font-weight: 700; color: {{ cell.textColor | default('var(--text-heading-color, #111827)') }}; text-align: center; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2;">{{ cell.label | default('') }}</div>
          {% if cell.value %}
          <div style="font-size: 10px; color: {{ cell.textColor | default('var(--text-body-color, #4b5563)') }}; margin-top: 2px; opacity: 0.8;">{{ cell.value }}</div>
          {% endif %}
        </div>
        {% endfor %}
      </div>
      {% endfor %}
      <div style="display: flex; margin-top: 6px; gap: 12px; justify-content: center;">
        {% for legend in matrixLegend | default([]) %}
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 10px; height: 10px; border-radius: 3px; background: {{ legend.color | default('#ccc') }};"></div>
          <span style="font-size: 10px; color: var(--text-body-color, #4b5563);">{{ legend.label | default('') }}</span>
        </div>
        {% endfor %}
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; overflow: hidden;">
      <div style="font-size: var(--at-small-size, 13px); font-weight: 700; color: var(--text-heading-color, #111827); flex-shrink: 0;">{{ mitigationTitle | default('Меры митигации') }}</div>
      {% for item in mitigations | default([]) %}
      <div class="card" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; overflow: hidden; border-left: 3px solid {{ item.color | default('var(--primary-accent-color, #6366f1)') }};">
        <div style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: {{ item.color | default('var(--primary-accent-color, #6366f1)') }};">{{ loop.index }}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: var(--at-tiny-size, 12px); font-weight: 600; color: var(--text-heading-color, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ item.title | default('') }}</div>
          {% if item.description %}
          <div style="font-size: 11px; color: var(--text-body-color, #4b5563); margin-top: 2px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ item.description }}</div>
          {% endif %}
          {% if item.priority %}
          <div style="display: inline-block; margin-top: 4px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: 4px; color: {{ item.color | default('#6366f1') }}; background: {{ item.color | default('#6366f1') }}15;">{{ item.priority }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
  {% if source %}
  <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
  </div>
  {% endif %}
</div>`,

  // ═══════════════════════════════════════════════════════
  // NEW LAYOUTS — Sprint 4 (content_shape support)
  // ═══════════════════════════════════════════════════════

  "card-grid": `{% set c_count = cards | default([]) | length %}{% set c_cols = c_count if c_count <= 3 else 3 %}{% set c_rows = ((c_count + c_cols - 1) / c_cols) | int %}{% set icon_size = 28 if c_count > 4 else 36 %}{% set icon_img = 14 if c_count > 4 else 18 %}{% set icon_radius = 8 if c_count > 4 else 10 %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 12px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 10px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.4; margin: 6px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
   <div style="display: grid; grid-template-columns: repeat({{ c_cols }}, 1fr); gap: var(--at-gap, 14px); width: 100%;">
    {% for card in cards | default([]) %}
    <div class="card" style="display: flex; flex-direction: column; padding: var(--at-card-padding, 16px); overflow: hidden; position: relative; min-height: 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-shrink: 0;">
        {% if card.icon and card.icon.url %}
        <div style="width: {{ icon_size }}px; height: {{ icon_size }}px; border-radius: {{ icon_radius }}px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="{{ card.icon.url }}" alt="" style="width: {{ icon_img }}px; height: {{ icon_img }}px;" />
        </div>
        {% else %}
        <div style="width: {{ icon_size }}px; height: {{ icon_size }}px; border-radius: {{ icon_radius }}px; background: var(--primary-accent-light, rgba(147,51,234,0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: var(--primary-accent-color, #9333ea); font-size: 14px; font-weight: 700;">{{ loop.index }}</span>
        </div>
        {% endif %}
        <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-heading-color, #111827); font-size: var(--at-small-size, 14px); font-weight: 600; line-height: 1.3;">{{ card.title | default('') }}</div>
        {% if card.badge %}
        <div style="flex-shrink: 0; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: {{ card.badge_color | default('var(--primary-accent-color, #9333ea)') }}; background: {{ card.badge_color | default('var(--primary-accent-color, #9333ea)') }}15;">{{ card.badge }}</div>
        {% endif %}
      </div>
      {% if card.description %}
      <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 12px); line-height: 1.4; flex: 1; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: {{ 2 if c_count > 4 else 3 }}; -webkit-box-orient: vertical;">{{ card.description }}</div>
      {% endif %}
      {% if card.value %}
      <div style="margin-top: auto; padding-top: 4px; font-size: 20px; font-weight: 800; color: var(--primary-accent-color, #9333ea);">{{ card.value }}</div>
      {% endif %}
    </div>
    {% endfor %}
   </div>
  </div>
</div>`,

  "financial-formula": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 32px; overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center;">
      {% for part in formulaParts | default([]) %}
      {% if part.type == 'operator' %}
      <div style="font-size: 36px; font-weight: 300; color: var(--text-body-color, #4b5563); line-height: 1;">{{ part.symbol | default('+') }}</div>
      {% elif part.type == 'equals' %}
      <div style="font-size: 36px; font-weight: 300; color: var(--primary-accent-color, #9333ea); line-height: 1;">=</div>
      {% else %}
      <div style="text-align: center; padding: 16px 24px; border-radius: 16px; background: {% if part.highlight %}color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, white){% else %}var(--card-background-color, #ffffff){% endif %}; border: {% if part.highlight %}2px solid var(--primary-accent-color, #9333ea){% else %}1px solid var(--card-border-color, rgba(0,0,0,0.08)){% endif %}; box-shadow: var(--card-shadow, 0 2px 12px rgba(0,0,0,0.06));">
        <div style="font-size: 28px; font-weight: 800; color: {% if part.highlight %}var(--primary-accent-color, #9333ea){% else %}var(--text-heading-color, #111827){% endif %}; line-height: 1.1;">{{ part.value | default('') }}</div>
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-body-color, #4b5563); margin-top: 6px;">{{ part.label | default('') }}</div>
      </div>
      {% endif %}
      {% endfor %}
    </div>
    {% if components and components | length > 0 %}
    <div style="display: grid; grid-template-columns: repeat({{ components | length }}, 1fr); gap: 16px; width: 100%; max-width: 900px;">
      {% for comp in components %}
      <div style="text-align: center; padding: 14px; border-radius: 12px; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08));">
        <div style="font-size: 20px; font-weight: 700; color: var(--text-heading-color, #111827);">{{ comp.value | default('') }}</div>
        <div style="font-size: 11px; color: var(--text-body-color, #4b5563); margin-top: 4px;">{{ comp.label | default('') }}</div>
        {% if comp.change %}
        <div style="font-size: 11px; font-weight: 600; margin-top: 4px; color: {% if comp.positive %}#16a34a{% else %}#dc2626{% endif %};">{{ comp.change }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
    {% endif %}
    {% if footnote %}
    <div style="font-size: 12px; color: var(--text-body-color, #4b5563); opacity: 0.7; text-align: center;">{{ footnote }}</div>
    {% endif %}
  </div>
</div>`,

  "big-statement": `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 48px 80px; text-align: center; overflow: hidden; position: relative;">
  <div style="position: absolute; top: -100px; right: -100px; width: 350px; height: 350px; border-radius: 50%; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 6%, transparent); pointer-events: none;"></div>
  <div style="position: absolute; bottom: -60px; left: -60px; width: 250px; height: 250px; border-radius: 50%; background: color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 5%, transparent); pointer-events: none;"></div>
  <div style="position: relative; z-index: 10; max-width: 800px;">
    {% if label %}
    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary-accent-color, #9333ea); margin-bottom: 20px;">{{ label }}</div>
    {% endif %}
    {% if bigNumber %}
    <div style="font-size: 72px; font-weight: 800; color: var(--primary-accent-color, #9333ea); line-height: 1; margin-bottom: 16px;">{{ bigNumber }}</div>
    {% endif %}
    <h1 style="color: var(--text-heading-color, #111827); font-size: 40px; font-weight: 700; line-height: 1.15; margin: 0 0 20px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">{{ title }}</h1>
    <div style="width: 60px; height: 3px; background: var(--primary-accent-color, #9333ea); border-radius: 2px; margin: 0 auto 20px;"></div>
    {% if subtitle %}
    <p style="color: var(--text-body-color, #4b5563); font-size: 18px; line-height: 1.6; margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;">{{ subtitle }}</p>
    {% endif %}
    {% if source %}
    <div style="margin-top: 24px; font-size: 12px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
    {% endif %}
  </div>
</div>`,

  "verdict-analysis": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
    {% if criteria and criteria | length > 0 %}
    <div style="display: grid; grid-template-columns: repeat({{ criteria | length if criteria | length <= 4 else 4 }}, 1fr); gap: 12px; flex-shrink: 0;">
      {% for item in criteria %}
      <div style="padding: 14px; border-radius: 12px; background: var(--card-background-color, #ffffff); border: 1px solid var(--card-border-color, rgba(0,0,0,0.08)); box-shadow: var(--card-shadow, 0 2px 12px rgba(0,0,0,0.06));">
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-body-color, #4b5563); margin-bottom: 6px;">{{ item.label | default('') }}</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text-heading-color, #111827);">{{ item.value | default('') }}</div>
        {% if item.detail %}
        <div style="font-size: 11px; color: var(--text-body-color, #4b5563); margin-top: 4px;">{{ item.detail }}</div>
        {% endif %}
      </div>
      {% endfor %}
    </div>
    {% endif %}
    <div style="flex: 1; display: flex; align-items: center; overflow: hidden;">
      <div style="width: 100%; padding: 20px 24px; border-radius: 16px; background: color-mix(in srgb, {{ verdictColor | default('var(--primary-accent-color, #9333ea)') }} 8%, white); border: 2px solid {{ verdictColor | default('var(--primary-accent-color, #9333ea)') }}20;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: {{ verdictColor | default('var(--primary-accent-color, #9333ea)') }}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            {% if verdictIcon %}
            <span style="color: white; font-size: 16px;">{{ verdictIcon }}</span>
            {% else %}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            {% endif %}
          </div>
          <div style="font-size: 18px; font-weight: 700; color: {{ verdictColor | default('var(--primary-accent-color, #9333ea)') }};">{{ verdictTitle | default('Вердикт') }}</div>
        </div>
        <div style="font-size: var(--at-body-size, 15px); color: var(--text-heading-color, #111827); line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;">{{ verdictText | default('') }}</div>
        {% if verdictDetails %}
        <div style="display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap;">
          {% for detail in verdictDetails %}
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: {{ verdictColor | default('var(--primary-accent-color, #9333ea)') }};"></div>
            <span style="font-size: 12px; color: var(--text-body-color, #4b5563);">{{ detail }}</span>
          </div>
          {% endfor %}
        </div>
        {% endif %}
      </div>
    </div>
  </div>
</div>`,

  // ═══════════════════════════════════════════════════════
  // ROUND 6 LAYOUTS
  // ═══════════════════════════════════════════════════════

  "vertical-timeline": `<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; overflow: hidden;">
    <div style="position: relative; display: flex; flex-direction: column; gap: var(--at-gap-sm, 10px); width: 100%; padding-left: 40px;">
      <div style="position: absolute; left: 15px; top: 4px; bottom: 4px; width: 2px; background: linear-gradient(to bottom, var(--primary-accent-color, #9333ea), color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 60%, transparent)); border-radius: 1px;"></div>
      {% for event in events | default([]) %}
      <div style="display: flex; align-items: flex-start; gap: 16px; position: relative;">
        <div style="position: absolute; left: -40px; top: 2px; width: 32px; height: 32px; border-radius: 50%; background: {% if event.highlight %}var(--primary-accent-color, #9333ea){% else %}var(--card-background-color, #ffffff){% endif %}; border: 2px solid var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          {% if event.icon and event.icon.url %}
          <img src="{{ event.icon.url }}" alt="" style="width: 14px; height: 14px; {% if event.highlight %}filter: brightness(0) invert(1);{% endif %}" />
          {% else %}
          <span style="font-size: 12px; font-weight: 700; color: {% if event.highlight %}#ffffff{% else %}var(--primary-accent-color, #9333ea){% endif %};">{{ loop.index }}</span>
          {% endif %}
        </div>
        <div class="card" style="flex: 1; min-width: 0; padding: var(--at-card-padding, 14px) 16px; {% if event.highlight %}border-left: 3px solid var(--primary-accent-color, #9333ea);{% endif %}">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
            {% if event.date %}
            <span style="font-size: var(--at-tiny-size, 11px); font-weight: 600; color: var(--primary-accent-color, #9333ea); text-transform: uppercase; letter-spacing: 0.05em;">{{ event.date }}</span>
            {% endif %}
            {% if event.badge %}
            <span style="font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: {{ event.badgeColor | default('color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, transparent)') }}; color: {{ event.badgeTextColor | default('var(--primary-accent-color, #9333ea)') }};">{{ event.badge }}</span>
            {% endif %}
          </div>
          <div style="color: var(--text-heading-color, #111827); font-size: var(--at-small-size, 14px); font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ event.title }}</div>
          {% if event.description %}
          <div style="color: var(--text-body-color, #4b5563); font-size: var(--at-tiny-size, 12px); line-height: 1.4; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-desc-clamp, 2); -webkit-box-orient: vertical;">{{ event.description }}</div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "comparison-table": `{% set ct_cols = columns | default([]) | length %}<div style="display: flex; flex-direction: column; height: 100%; padding: 36px 48px 32px; overflow: hidden;">
  <div style="flex-shrink: 0; margin-bottom: 16px;">
    <h1 style="color: var(--text-heading-color, #111827); font-size: var(--at-title-size, 36px); font-weight: 700; line-height: var(--at-title-lh, 1.1); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: var(--at-title-clamp, 2); -webkit-box-orient: vertical;">{{ title }}</h1>
    <div class="accent-line" style="margin-top: 12px;"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563); font-size: var(--at-body-size, 15px); line-height: 1.5; margin: 8px 0 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: flex-start; overflow: hidden;">
    <div style="width: 100%; border-radius: 16px; overflow: auto; max-height: 100%;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 12px 16px; font-size: var(--at-small-size, 13px); font-weight: 700; color: #ffffff; background: var(--primary-accent-color, #9333ea); border-bottom: 2px solid var(--primary-accent-color, #9333ea); position: sticky; top: 0; z-index: 1;">{{ featureLabel | default('Параметр') }}</th>
            {% for col in columns | default([]) %}
            <th style="text-align: center; padding: 12px 16px; font-size: var(--at-small-size, 13px); font-weight: 700; color: #ffffff; background: {% if col.highlight %}var(--primary-accent-color, #9333ea){% else %}color-mix(in srgb, var(--primary-accent-color, #9333ea) 85%, black){% endif %}; border-bottom: 2px solid var(--primary-accent-color, #9333ea); position: sticky; top: 0; z-index: 1; {% if col.highlight %}box-shadow: inset 0 -3px 0 var(--secondary-accent-color, #3b82f6);{% endif %}">{{ col.name | default('') }}</th>
            {% endfor %}
          </tr>
        </thead>
        <tbody>
          {% for feature in features | default([]) %}
          <tr>
            <td style="padding: 10px 16px; font-size: var(--at-tiny-size, 12px); font-weight: 600; color: var(--text-heading-color, #111827); background: var(--card-background-color, #ffffff); border-bottom: 1px solid var(--card-border-color, rgba(0,0,0,0.06)); white-space: nowrap;">{{ feature.name | default('') }}</td>
            {% for val in feature.values | default([]) %}
            <td style="text-align: center; padding: 10px 16px; font-size: var(--at-tiny-size, 12px); color: var(--text-body-color, #4b5563); background: var(--card-background-color, #ffffff); border-bottom: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
              {% if val == true or val == 'yes' or val == '✓' %}
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #dcfce7; display: inline-flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
              {% elif val == false or val == 'no' or val == '✗' %}
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #fef2f2; display: inline-flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
              {% elif val == 'partial' or val == '~' %}
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #fef9c3; display: inline-flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
              {% else %}
              <span style="font-weight: 500;">{{ val }}</span>
              {% endif %}
            </td>
            {% endfor %}
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
  {% if footnote %}
  <div style="flex-shrink: 0; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--card-border-color, rgba(0,0,0,0.06));">
    <div style="font-size: 10px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ footnote }}</div>
  </div>
  {% endif %}
</div>`,

  "quote-highlight": `<div style="display: flex; height: 100%; overflow: hidden; position: relative;">
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--slide-bg-accent-gradient, linear-gradient(135deg, var(--primary-accent-color, #9333ea), color-mix(in srgb, var(--secondary-accent-color, #3b82f6) 70%, var(--primary-accent-color, #9333ea)))); opacity: 0.06;"></div>
  <div style="flex: 1 1 0%; display: flex; flex-direction: column; justify-content: center; padding: 48px 64px; position: relative; z-index: 1; min-width: 0;">
    <div style="position: relative; margin-bottom: 32px;">
      <div style="position: absolute; top: -20px; left: -10px; font-size: 120px; line-height: 1; color: var(--primary-accent-color, #9333ea); opacity: 0.15; font-family: Georgia, serif; pointer-events: none;">“</div>
      <blockquote style="color: var(--text-heading-color, #111827); font-size: 28px; font-weight: 600; line-height: 1.4; margin: 0; padding-left: 24px; border-left: 4px solid var(--primary-accent-color, #9333ea); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical;">{{ quote }}</blockquote>
    </div>
    <div style="display: flex; align-items: center; gap: 16px; padding-left: 24px;">
      {% if authorImage and authorImage.url %}
      <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--primary-accent-color, #9333ea);">
        <img src="{{ authorImage.url }}" alt="{{ author | default('') }}" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      {% else %}
      <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: #ffffff; font-size: 18px; font-weight: 700;">{{ author[0] | default('“') }}</span>
      </div>
      {% endif %}
      <div>
        <div style="color: var(--text-heading-color, #111827); font-size: 16px; font-weight: 700;">{{ author | default('') }}</div>
        {% if role %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 13px; margin-top: 2px;">{{ role }}</div>
        {% endif %}
      </div>
    </div>
    {% if context %}
    <div style="margin-top: 24px; padding: 12px 16px; border-radius: 10px; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 6%, transparent); border: 1px solid color-mix(in srgb, var(--primary-accent-color, #9333ea) 12%, transparent);">
      <div style="font-size: 12px; color: var(--text-body-color, #4b5563); line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ context }}</div>
    </div>
    {% endif %}
    {% if source %}
    <div style="margin-top: 12px; padding-left: 24px;">
      <div style="font-size: 11px; color: var(--text-body-color, #4b5563); opacity: 0.6;">{{ source }}</div>
    </div>
    {% endif %}
  </div>
  {% if accentPanel %}
  <div style="width: 320px; flex-shrink: 0; background: var(--slide-bg-accent-gradient, var(--primary-accent-color, #9333ea)); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 32px; text-align: center;">
    {% if accentPanel.bigNumber %}
    <div style="font-size: 64px; font-weight: 800; color: #ffffff; line-height: 1;">{{ accentPanel.bigNumber }}</div>
    {% endif %}
    {% if accentPanel.label %}
    <div style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); margin-top: 12px; text-transform: uppercase; letter-spacing: 0.05em;">{{ accentPanel.label }}</div>
    {% endif %}
    {% if accentPanel.description %}
    <div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px; line-height: 1.4;">{{ accentPanel.description }}</div>
    {% endif %}
  </div>
  {% endif %}
</div>`,

  "kanban-board": `<div style="display: flex; flex-direction: column; height: 100%; padding: 40px 48px 28px; overflow: hidden;">
  <h2 style="color: var(--text-heading-color, #111827); font-size: 28px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ title }}</h2>
  {% if description %}
  <p style="color: var(--text-body-color, #6b7280); font-size: 13px; margin: 0 0 16px 0; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ description }}</p>
  {% else %}
  <div style="margin-bottom: 16px;"></div>
  {% endif %}
  <div style="display: flex; gap: 16px; flex: 1; min-height: 0; overflow: hidden;">
    {% for column in columns %}
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: {% if column.color %}{{ column.color }}12{% else %}var(--card-background-color, #f9fafb){% endif %}; border-radius: 12px; border: 1px solid {% if column.color %}{{ column.color }}30{% else %}#e5e7eb{% endif %}; overflow: hidden;">
      <div style="padding: 12px 14px; border-bottom: 2px solid {% if column.color %}{{ column.color }}{% else %}var(--primary-accent-color, #9333ea){% endif %};">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; font-weight: 700; color: {% if column.color %}{{ column.color }}{% else %}var(--text-heading-color, #111827){% endif %}; text-transform: uppercase; letter-spacing: 0.05em;">{{ column.title }}</span>
          {% if column.cards %}
          <span style="font-size: 11px; font-weight: 600; color: var(--text-body-color, #9ca3af); background: rgba(0,0,0,0.05); border-radius: 10px; padding: 2px 8px;">{{ column.cards | length }}</span>
          {% endif %}
        </div>
      </div>
      <div style="flex: 1; padding: 10px; overflow: hidden; display: flex; flex-direction: column; gap: 8px;">
        {% if column.cards %}
        {% for card in column.cards %}
        <div style="background: white; border-radius: 8px; padding: 10px 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.04);{% if card.priority == 'high' %} border-left: 3px solid #ef4444;{% elif card.priority == 'medium' %} border-left: 3px solid #f59e0b;{% elif card.priority == 'low' %} border-left: 3px solid #22c55e;{% endif %}">
          <div style="font-size: 12.5px; font-weight: 600; color: var(--text-heading-color, #1f2937); margin-bottom: 3px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ card.title }}</div>
          {% if card.description %}
          <div style="font-size: 11px; color: var(--text-body-color, #6b7280); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ card.description }}</div>
          {% endif %}
          {% if card.tags or card.assignee %}
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
            {% if card.tags %}
            {% for tag in card.tags %}
            <span style="font-size: 10px; font-weight: 500; padding: 1px 6px; border-radius: 4px; background: {% if column.color %}{{ column.color }}18{% else %}#f3f4f6{% endif %}; color: {% if column.color %}{{ column.color }}{% else %}#6b7280{% endif %};">{{ tag }}</span>
            {% endfor %}
            {% endif %}
            {% if card.assignee %}
            <span style="font-size: 10px; color: var(--text-body-color, #9ca3af); margin-left: auto;">{{ card.assignee }}</span>
            {% endif %}
          </div>
          {% endif %}
        </div>
        {% endfor %}
        {% endif %}
      </div>
    </div>
    {% endfor %}
  </div>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
    <span style="font-size: 10px; color: var(--text-body-color, #9ca3af);">{{ footerText | default('') }}</span>
    <span style="font-size: 10px; color: var(--text-body-color, #9ca3af);">{{ slideNumber | default('') }}</span>
  </div>
</div>`,

  "org-chart": `<div style="display: flex; flex-direction: column; height: 100%; padding: 40px 48px 28px; overflow: hidden;">
  <h2 style="color: var(--text-heading-color, #111827); font-size: 28px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.2; text-align: center;">{{ title }}</h2>
  {% if description %}
  <p style="color: var(--text-body-color, #6b7280); font-size: 13px; margin: 0 0 20px 0; line-height: 1.4; text-align: center;">{{ description }}</p>
  {% endif %}
  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow: hidden; gap: 0;">
    <!-- Root node -->
    <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 0;">
      <div style="background: linear-gradient(135deg, var(--primary-accent-color, #6366f1), var(--secondary-accent-color, #8b5cf6)); border-radius: 12px; padding: 14px 28px; text-align: center; box-shadow: 0 4px 16px rgba(99,102,241,0.25); min-width: 180px; max-width: 320px;">
        <div style="color: #ffffff; font-size: 16px; font-weight: 700; line-height: 1.3;">{{ root.name }}</div>
        {% if root.role %}<div style="color: rgba(255,255,255,0.8); font-size: 11px; margin-top: 2px;">{{ root.role }}</div>{% endif %}
      </div>
      <!-- Connector line down from root -->
      <div style="width: 2px; height: 20px; background: var(--primary-accent-color, #6366f1); opacity: 0.4;"></div>
    </div>
    <!-- Horizontal connector bar -->
    {% if children.length > 1 %}
    <div style="width: {{ children.length > 4 ? '90%' : '70%' }}; height: 2px; background: var(--primary-accent-color, #6366f1); opacity: 0.25; margin-bottom: 0;"></div>
    {% endif %}
    <!-- Children row -->
    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; width: 100%;">
      {% for child in children %}
      <div style="display: flex; flex-direction: column; align-items: center; flex: 0 1 auto; min-width: 140px; max-width: 220px;">
        <!-- Connector line down to child -->
        <div style="width: 2px; height: 16px; background: var(--primary-accent-color, #6366f1); opacity: 0.3;"></div>
        <div style="background: var(--card-background-color, #ffffff); border: 1.5px solid color-mix(in srgb, var(--primary-accent-color, #6366f1) 20%, transparent); border-radius: 10px; padding: 12px 16px; text-align: center; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          {% if child.avatar %}
          <div style="width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--primary-accent-color, #6366f1) 12%, transparent); display: flex; align-items: center; justify-content: center; margin: 0 auto 6px; font-size: 16px;">{{ child.avatar }}</div>
          {% endif %}
          <div style="color: var(--text-heading-color, #111827); font-size: 13px; font-weight: 600; line-height: 1.3;">{{ child.name }}</div>
          {% if child.role %}<div style="color: var(--text-body-color, #6b7280); font-size: 10px; margin-top: 2px; line-height: 1.3;">{{ child.role }}</div>{% endif %}
          {% if child.detail %}<div style="color: var(--primary-accent-color, #6366f1); font-size: 9px; margin-top: 4px; font-weight: 500;">{{ child.detail }}</div>{% endif %}
        </div>
        <!-- Sub-children (grandchildren) -->
        {% if child.members and child.members.length > 0 %}
        <div style="width: 1.5px; height: 12px; background: var(--primary-accent-color, #6366f1); opacity: 0.2;"></div>
        <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
          {% for member in child.members %}
          <div style="background: color-mix(in srgb, var(--primary-accent-color, #6366f1) 5%, var(--card-background-color, #ffffff)); border: 1px solid color-mix(in srgb, var(--primary-accent-color, #6366f1) 10%, transparent); border-radius: 6px; padding: 6px 10px; text-align: center;">
            <span style="color: var(--text-heading-color, #374151); font-size: 10px; font-weight: 500;">{{ member.name }}</span>
            {% if member.role %}<span style="color: var(--text-body-color, #9ca3af); font-size: 9px; margin-left: 4px;">{{ member.role }}</span>{% endif %}
          </div>
          {% endfor %}
        </div>
        {% endif %}
      </div>
      {% endfor %}
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
/* ── Adaptive Typography ───────────────────────────────── */
/* Density levels: normal (default), compact (many items), dense (very many items) */
/* These classes are applied to the slide root div by renderSlide() based on content analysis */

/* CSS custom properties for adaptive sizing — templates use these instead of hardcoded values */
.slide {
  --at-title-size: 36px;
  --at-title-lh: 1.1;
  --at-title-clamp: 2;
  --at-subtitle-size: 20px;
  --at-body-size: 16px;
  --at-body-lh: 1.5;
  --at-small-size: 14px;
  --at-label-size: 13px;
  --at-tiny-size: 12px;
  --at-card-padding: 24px;
  --at-gap: 16px;
  --at-gap-sm: 12px;
  --at-bullet-clamp: 3;
  --at-desc-clamp: 2;
  --at-icon-size: 48px;
  --at-icon-font: 20px;
  --at-value-size: 28px;
}
/* Compact: 5-7 items, or long text — reduce sizes ~15-20% */
.slide.density-compact {
  --at-title-size: 30px;
  --at-subtitle-size: 17px;
  --at-body-size: 14px;
  --at-body-lh: 1.4;
  --at-small-size: 13px;
  --at-label-size: 11px;
  --at-tiny-size: 11px;
  --at-card-padding: 18px;
  --at-gap: 12px;
  --at-gap-sm: 8px;
  --at-bullet-clamp: 2;
  --at-desc-clamp: 1;
  --at-icon-size: 40px;
  --at-icon-font: 17px;
  --at-value-size: 24px;
}
/* Dense: 8+ items, or very long text — reduce sizes ~30% */
.slide.density-dense {
  --at-title-size: 26px;
  --at-subtitle-size: 15px;
  --at-body-size: 13px;
  --at-body-lh: 1.35;
  --at-small-size: 12px;
  --at-label-size: 10px;
  --at-tiny-size: 10px;
  --at-card-padding: 14px;
  --at-gap: 10px;
  --at-gap-sm: 6px;
  --at-bullet-clamp: 2;
  --at-desc-clamp: 1;
  --at-icon-size: 36px;
  --at-icon-font: 15px;
  --at-value-size: 20px;
}
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

  // Replace raw HTML expressions {{{ ... }}} (no escaping, for SVG injection)
  processed = processed.replace(/\{\{\{(.+?)\}\}\}/g, (_match, expr) => {
    try {
      const val = evalExpression(expr.trim(), data);
      return val !== undefined && val !== null ? String(val) : "";
    } catch {
      return "";
    }
  });

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
  let result = template;
  let safety = 0;

  // Use balanced matching to handle nested {% if %}...{% endif %} blocks
  while (result.includes("{% if") && safety < 30) {
    safety++;

    // Find the INNERMOST {% if %}...{% endif %} block (one with no nested {% if %} inside)
    // This ensures we process from inside-out, handling nesting correctly
    const ifStart = findInnermostIf(result);
    if (ifStart === -1) break;

    // Parse the if tag
    const tagEnd = result.indexOf("%}", ifStart);
    if (tagEnd === -1) break;
    const tag = result.substring(ifStart, tagEnd + 2);
    const tagMatch = tag.match(/\{%[-\s]*if\s+(.+?)\s*[-]?%\}/);
    if (!tagMatch) break;
    const condition = tagMatch[1];

    // Find the matching endif (the first one, since we picked innermost if)
    const bodyStart = tagEnd + 2;
    const endifMatch = result.substring(bodyStart).match(/\{%[-\s]*endif\s*[-]?%\}/);
    if (!endifMatch || endifMatch.index === undefined) break;
    const endifStart = bodyStart + endifMatch.index;
    const endifEnd = endifStart + endifMatch[0].length;

    const body = result.substring(bodyStart, endifStart);
    const before = result.substring(0, ifStart);
    const after = result.substring(endifEnd);

    // Split on elif/else and evaluate
    const parts = splitIfBody(body);
    let replacement = "";

    for (const part of parts) {
      if (part.type === "if" || part.type === "elif") {
        const cond = part.type === "if" ? condition : part.condition;
        if (evalCondition(cond!, data)) {
          replacement = part.body;
          break;
        }
      } else if (part.type === "else") {
        replacement = part.body;
        break;
      }
    }

    result = before + replacement + after;
  }

  return result;
}

function findInnermostIf(template: string): number {
  // Find the last {% if %} that appears before any {% endif %}
  // This is the innermost one (no nested {% if %} between it and its {% endif %})
  let lastIfPos = -1;
  let searchPos = 0;

  while (searchPos < template.length) {
    const nextIf = template.indexOf("{% if", searchPos);
    const nextEndif = template.indexOf("{% endif", searchPos);
    // Also check whitespace variants
    const nextEndif2 = template.indexOf("{%- endif", searchPos);
    const nextEndif3 = template.indexOf("{%  endif", searchPos);

    let actualEndif = nextEndif;
    if (nextEndif2 !== -1 && (actualEndif === -1 || nextEndif2 < actualEndif)) actualEndif = nextEndif2;
    if (nextEndif3 !== -1 && (actualEndif === -1 || nextEndif3 < actualEndif)) actualEndif = nextEndif3;

    if (nextIf === -1) break;
    if (actualEndif !== -1 && actualEndif < nextIf) {
      // Found an endif before the next if — the last if we found is innermost
      break;
    }

    lastIfPos = nextIf;
    searchPos = nextIf + 5;
  }

  return lastIfPos;
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

  // Handle Jinja2 ternary: value_if_true if condition else value_if_false
  // e.g. "s_count if s_count <= 5 else 5"
  const ternaryMatch = trimmed.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
  if (ternaryMatch) {
    const condition = evalCondition(ternaryMatch[2].trim(), data);
    if (condition) {
      return evalExpression(ternaryMatch[1].trim(), data);
    } else {
      return evalExpression(ternaryMatch[3].trim(), data);
    }
  }

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

  // Handle arithmetic operations: a % b, a * b, a + b, a - b, a / b
  // Check for binary arithmetic operators (but not inside parentheses or strings)
  const arithMatch = trimmed.match(/^(.+?)\s*([%*\/])\s*(.+)$/);
  if (arithMatch) {
    const left = evalExpression(arithMatch[1].trim(), data);
    const right = evalExpression(arithMatch[3].trim(), data);
    if (typeof left === 'number' && typeof right === 'number') {
      switch (arithMatch[2]) {
        case '%': return left % right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
      }
    }
  }
  // Handle + and - separately (lower precedence, and - could be unary)
  const addSubMatch = trimmed.match(/^(.+?)\s*([+\-])\s*(.+)$/);
  if (addSubMatch && addSubMatch[1].trim()) {
    const left = evalExpression(addSubMatch[1].trim(), data);
    const right = evalExpression(addSubMatch[3].trim(), data);
    if (typeof left === 'number' && typeof right === 'number') {
      switch (addSubMatch[2]) {
        case '+': return left + right;
        case '-': return left - right;
      }
    }
  }

  // Handle parenthesized expressions: (expr)
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return evalExpression(trimmed.slice(1, -1), data);
  }

  // Handle dot notation and array access: a.b.c, a[0]
  const parts = trimmed.split(/\./).filter(Boolean);
  let val: any = data;
  for (const part of parts) {
    if (val === undefined || val === null) return undefined;
    // Handle array access within part: e.g. items[0]
    const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (bracketMatch) {
      val = val[bracketMatch[1]];
      if (val === undefined || val === null) return undefined;
      val = val[parseInt(bracketMatch[2])];
    } else {
      val = val[part];
    }
  }

  return val;
}

// ═══════════════════════════════════════════════════════
// ADAPTIVE TYPOGRAPHY — Content Density Analysis
// ═══════════════════════════════════════════════════════

type DensityLevel = "normal" | "compact" | "dense";

/**
 * Analyze slide data to determine content density.
 * Returns a density level that controls CSS custom properties for font sizing.
 *
 * Thresholds per layout type:
 * - List-based (text-slide, checklist, pros-cons, timeline, etc.): compact at 5+, dense at 8+
 * - Grid-based (process-steps, icons-numbers, team-profiles): compact at 5+, dense at 7+
 * - Two-panel (comparison, two-column, pros-cons): compact at 4+ per side, dense at 6+
 * - Text-heavy (title, description length): compact at 120+ chars, dense at 200+
 */
export function computeDensity(layoutId: string, data: Record<string, any>): DensityLevel {
  // Layouts that don't need adaptive typography
  const staticLayouts = ["title-slide", "section-header", "final-slide", "image-fullscreen", "video-embed", "quote-slide"];
  if (staticLayouts.includes(layoutId)) return "normal";

  // Helper: count items in an array field
  const countItems = (field: any): number => Array.isArray(field) ? field.length : 0;

  // Helper: measure total text length across items
  const totalTextLen = (...fields: any[]): number => {
    let len = 0;
    for (const f of fields) {
      if (typeof f === "string") len += f.length;
      else if (Array.isArray(f)) {
        for (const item of f) {
          if (typeof item === "string") len += item.length;
          else if (item && typeof item === "object") {
            len += (item.title || "").length + (item.description || "").length + (item.text || "").length;
          }
        }
      }
    }
    return len;
  };

  // Title length factor — very long titles push toward compact
  const titleLen = typeof data.title === "string" ? data.title.length : 0;
  const titlePressure = titleLen > 80 ? 1 : 0;

  let itemCount = 0;
  let textLength = 0;
  let compactThreshold = 5;
  let denseThreshold = 8;

  switch (layoutId) {
    case "text-slide":
      itemCount = countItems(data.bullets);
      textLength = totalTextLen(data.bullets, data.description);
      compactThreshold = 5;
      denseThreshold = 7;
      break;

    case "two-column":
      itemCount = Math.max(
        countItems(data.leftColumn?.bullets),
        countItems(data.rightColumn?.bullets)
      );
      textLength = totalTextLen(data.leftColumn?.bullets, data.rightColumn?.bullets);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "comparison":
      itemCount = Math.max(
        countItems(data.optionA?.points),
        countItems(data.optionB?.points)
      );
      textLength = totalTextLen(data.optionA?.points, data.optionB?.points);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "pros-cons":
      itemCount = Math.max(
        countItems(data.pros?.items),
        countItems(data.cons?.items)
      );
      textLength = totalTextLen(data.pros?.items, data.cons?.items);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "timeline":
      itemCount = countItems(data.events);
      textLength = totalTextLen(data.events);
      compactThreshold = 5;
      denseThreshold = 7;
      break;

    case "process-steps":
      itemCount = countItems(data.steps);
      textLength = totalTextLen(data.steps);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "icons-numbers":
      itemCount = countItems(data.metrics);
      textLength = totalTextLen(data.metrics);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "team-profiles":
      itemCount = countItems(data.members);
      textLength = totalTextLen(data.members);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "checklist":
      itemCount = countItems(data.items);
      textLength = totalTextLen(data.items);
      compactThreshold = 6;
      denseThreshold = 10;
      break;

    case "agenda-table-of-contents":
      itemCount = countItems(data.sections);
      textLength = totalTextLen(data.sections);
      compactThreshold = 5;
      denseThreshold = 8;
      break;

    case "swot-analysis": {
      const maxQ = Math.max(
        countItems(data.strengths?.items),
        countItems(data.weaknesses?.items),
        countItems(data.opportunities?.items),
        countItems(data.threats?.items)
      );
      itemCount = maxQ;
      compactThreshold = 4;
      denseThreshold = 6;
      break;
    }

    case "matrix-2x2": {
      const maxQ2 = Math.max(
        countItems(data.topLeft?.items),
        countItems(data.topRight?.items),
        countItems(data.bottomLeft?.items),
        countItems(data.bottomRight?.items)
      );
      itemCount = maxQ2;
      compactThreshold = 3;
      denseThreshold = 5;
      break;
    }

    case "funnel":
      itemCount = countItems(data.stages);
      textLength = totalTextLen(data.stages);
      compactThreshold = 5;
      denseThreshold = 7;
      break;

    case "roadmap":
      itemCount = countItems(data.milestones);
      textLength = totalTextLen(data.milestones);
      compactThreshold = 5;
      denseThreshold = 7;
      break;

    case "pyramid":
      itemCount = countItems(data.levels);
      textLength = totalTextLen(data.levels);
      compactThreshold = 5;
      denseThreshold = 7;
      break;

    case "table-slide": {
      const rows = countItems(data.rows);
      const cols = countItems(data.headers);
      itemCount = rows;
      // Tables with many columns also need density reduction
      if (cols > 5) itemCount = Math.max(itemCount, cols);
      compactThreshold = 5;
      denseThreshold = 8;
      break;
    }

    case "highlight-stats":
      itemCount = countItems(data.supportingStats);
      compactThreshold = 3;
      denseThreshold = 5;
      break;

    case "image-text":
      textLength = totalTextLen(data.bullets, data.description);
      itemCount = countItems(data.bullets);
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    case "chart-slide":
    case "waterfall-chart":
      // Charts are mostly visual, but long descriptions can overflow
      textLength = (data.description || "").length;
      compactThreshold = 999; // Only text-based
      denseThreshold = 999;
      break;

    case "logo-grid":
      itemCount = countItems(data.logos);
      compactThreshold = 8;
      denseThreshold = 12;
      break;

    case "dual-chart":
      // Two chart cards — mostly visual, density depends on description/insight text
      textLength = (data.description || "").length + (data.leftChart?.insight || "").length + (data.rightChart?.insight || "").length;
      compactThreshold = 999;
      denseThreshold = 999;
      break;

    case "risk-matrix": {
      const matrixRows = countItems(data.matrixRows);
      const mitigCount = countItems(data.mitigations);
      itemCount = Math.max(matrixRows, mitigCount);
      textLength = totalTextLen(data.mitigations);
      compactThreshold = 4;
      denseThreshold = 6;
      break;
    }

    case "card-grid":
      itemCount = countItems(data.cards);
      textLength = totalTextLen(data.cards);
      compactThreshold = 4;
      denseThreshold = 7;
      break;

    case "financial-formula":
      itemCount = countItems(data.formulaParts) + countItems(data.components);
      compactThreshold = 8;
      denseThreshold = 12;
      break;

    case "big-statement":
      textLength = ((data.title || "").length + (data.subtitle || "").length);
      compactThreshold = 999;
      denseThreshold = 999;
      break;

    case "verdict-analysis":
      itemCount = countItems(data.criteria);
      textLength = (data.verdictText || "").length;
      compactThreshold = 4;
      denseThreshold = 6;
      break;

    default:
      return "normal";
  }

  // Text length can also push density up
  const textPressure = textLength > 600 ? 2 : textLength > 300 ? 1 : 0;

  // Compute effective score
  const effectiveCount = itemCount + titlePressure + textPressure;

  if (effectiveCount >= denseThreshold) return "dense";
  if (effectiveCount >= compactThreshold) return "compact";
  return "normal";
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export function renderSlide(layoutId: string, slideData: Record<string, any>): string {
  const template = LAYOUT_TEMPLATES[layoutId] || LAYOUT_TEMPLATES["text-slide"];
  // Process inline markdown (**bold**, *italic*) in text fields
  const processedData = processSlideDataMarkdown(slideData);

  // Compute content density and apply auto-density fallback
  const initialDensity = computeDensity(layoutId, slideData);
  const density = autoDensity(layoutId, slideData, initialDensity);
  processedData._density = density;

  let content = renderTemplate(template, processedData);

  // Inject density class into the root <div> of the template
  // This enables CSS custom properties (--at-*) to scale typography
  if (density !== "normal") {
    content = injectDensityClass(content, density);
  }

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

/**
 * Inject a density CSS class into the first <div> of the rendered HTML.
 * Adds `density-compact` or `density-dense` to the root element.
 */
function injectDensityClass(html: string, density: DensityLevel): string {
  // Find the first <div and add the class
  const firstDivIdx = html.indexOf("<div");
  if (firstDivIdx === -1) return html;

  const tagEnd = html.indexOf(">", firstDivIdx);
  if (tagEnd === -1) return html;

  const tag = html.substring(firstDivIdx, tagEnd);
  const densityClass = `density-${density}`;

  // Check if there's already a class attribute
  const classMatch = tag.match(/class="([^"]*)"/);  
  if (classMatch) {
    // Append to existing class
    const newTag = tag.replace(`class="${classMatch[1]}"`, `class="${classMatch[1]} ${densityClass}"`);
    return html.substring(0, firstDivIdx) + newTag + html.substring(tagEnd);
  } else {
    // Add class attribute
    return html.substring(0, firstDivIdx + 4) + ` class="${densityClass}"` + html.substring(firstDivIdx + 4);
  }
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
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 11 } } },
          datalabels: false
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              autoSkipPadding: 12,
              font: { size: 11 }
            }
          },
          y: {
            ticks: {
              font: { size: 11 },
              maxTicksLimit: 6
            }
          }
        },
        layout: { padding: { top: 10, right: 10 } }
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
