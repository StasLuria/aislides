/**
 * Template Engine — renders slide HTML from layout templates + data.
 * Uses Nunjucks for Jinja2-compatible template rendering.
 * Templates are embedded as strings (ported from Python backend).
 */

// ═══════════════════════════════════════════════════════
// LAYOUT TEMPLATES (Jinja2/Nunjucks syntax)
// ═══════════════════════════════════════════════════════

const LAYOUT_TEMPLATES: Record<string, string> = {
  "title-slide": `<div class="relative z-10 flex h-full px-16 pt-12 pb-8">
  <div class="slide-decor-circle slide-decor-top-right"></div>
  <div class="slide-decor-circle slide-decor-bottom-left"></div>
  <div class="flex-1 flex items-center justify-center pr-8">
    <div class="w-full max-w-lg h-80 rounded-2xl overflow-hidden shadow-lg">
      {% if image and image.url %}
      <img src="{{ image.url }}" alt="{{ image.alt | default('') }}" class="w-full h-full object-cover" />
      {% else %}
      <div class="w-full h-full flex items-center justify-center" style="background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, white);">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--primary-accent-color, #9333ea); opacity: 0.4;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      {% endif %}
    </div>
  </div>
  <div class="flex-1 flex flex-col justify-center pl-8 space-y-6">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold leading-tight">{{ title }}</h1>
    <div class="accent-line"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg leading-relaxed">{{ description }}</p>
    {% endif %}
    <div class="rounded-lg p-4 border" style="border-color: #e5e7eb; background: rgba(255,255,255,0.5); backdrop-filter: blur(8px);">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: var(--primary-accent-color, #9333ea);">
          <span class="font-bold text-sm text-white">{{ initials | default('') }}</span>
        </div>
        <div class="flex flex-col">
          <span style="color: var(--text-heading-color, #111827);" class="text-lg font-bold">{{ presenterName | default('') }}</span>
          <span style="color: var(--text-body-color, #4b5563);" class="text-sm font-medium">{{ presentationDate | default('') }}</span>
        </div>
      </div>
    </div>
  </div>
</div>`,

  "section-header": `<div class="flex flex-col items-center justify-center h-full px-16 text-center" style="background: var(--slide-bg-accent-gradient, var(--primary-accent-color));">
  <div class="slide-decor-circle slide-decor-top-right"></div>
  <div class="slide-decor-circle slide-decor-bottom-left"></div>
  <div class="relative z-10 flex flex-col items-center">
    <div style="width: 80px; height: 4px; background: rgba(255,255,255,0.5); border-radius: 2px; margin-bottom: 24px;"></div>
    <h1 style="color: #ffffff;" class="text-6xl font-bold leading-tight mb-4">{{ title }}</h1>
    {% if subtitle %}
    <p style="color: rgba(255,255,255,0.8);" class="text-xl leading-relaxed max-w-2xl">{{ subtitle }}</p>
    {% endif %}
  </div>
</div>`,

  "text-slide": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="flex items-center gap-4 mb-6" style="flex-shrink: 0;">
    {% if icon and icon.url %}
    <div class="icon-circle"><img src="{{ icon.url }}" alt="{{ icon.name | default('') }}" /></div>
    {% endif %}
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
  </div>
  <div class="accent-line mb-6" style="flex-shrink: 0;"></div>
  <div style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-4">
    {% for bullet in bullets | default([]) %}
    <div class="bullet-row">
      <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: var(--primary-accent-color, #9333ea);"></div>
      <div>
        <div style="color: var(--text-heading-color, #111827);" class="font-semibold text-base">{{ bullet.title | default('') }}</div>
        <div style="color: var(--text-body-color, #4b5563);" class="text-sm leading-relaxed mt-1">{{ bullet.description | default('') }}</div>
      </div>
    </div>
    {% endfor %}
  </div>
</div>`,

  "two-column": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="text-center mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line-center mt-4"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px;">
    <div class="card" style="overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <h2 style="color: var(--text-heading-color, #111827); flex-shrink: 0;" class="text-2xl font-semibold mb-4">{{ leftColumn.title | default('') }}</h2>
      <ul style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-3">
        {% for bullet in leftColumn.bullets | default([]) %}
        <li class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: var(--primary-accent-color, #9333ea);"></div>
          <span style="color: var(--text-body-color, #4b5563);" class="text-base">{{ bullet }}</span>
        </li>
        {% endfor %}
      </ul>
    </div>
    <div class="card" style="overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <h2 style="color: var(--text-heading-color, #111827); flex-shrink: 0;" class="text-2xl font-semibold mb-4">{{ rightColumn.title | default('') }}</h2>
      <ul style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-3">
        {% for bullet in rightColumn.bullets | default([]) %}
        <li class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: var(--secondary-accent-color, #3b82f6);"></div>
          <span style="color: var(--text-body-color, #4b5563);" class="text-base">{{ bullet }}</span>
        </li>
        {% endfor %}
      </ul>
    </div>
  </div>
</div>`,

  "image-text": `<div class="flex h-full px-16 pt-10 pb-10 gap-8">
  <div class="flex-1 flex items-center justify-center">
    <div class="w-full h-full rounded-2xl overflow-hidden shadow-lg">
      {% if image and image.url %}
      <img src="{{ image.url }}" alt="{{ image.alt | default('') }}" class="w-full h-full object-cover" />
      {% else %}
      <div class="w-full h-full flex items-center justify-center" style="background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 10%, #f3f4f6);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--primary-accent-color, #9333ea); opacity: 0.3;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      {% endif %}
    </div>
  </div>
  <div class="flex-1 flex flex-col justify-center">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-4xl font-bold mb-4">{{ title }}</h1>
    <div class="accent-line mb-6"></div>
    <div class="space-y-3">
      {% for bullet in bullets | default([]) %}
      <div class="flex items-start gap-3">
        <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: var(--primary-accent-color, #9333ea);"></div>
        <div>
          <div style="color: var(--text-heading-color, #111827);" class="font-semibold text-base">{{ bullet.title | default('') }}</div>
          <div style="color: var(--text-body-color, #4b5563);" class="text-sm leading-relaxed mt-1">{{ bullet.description | default('') }}</div>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "image-fullscreen": `<div class="relative h-full overflow-hidden">
  {% if backgroundImage and backgroundImage.url %}
  <img src="{{ backgroundImage.url }}" alt="{{ backgroundImage.alt | default('') }}" class="absolute inset-0 w-full h-full object-cover" />
  {% else %}
  <div class="absolute inset-0" style="background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
  {% endif %}
  <div class="gradient-overlay-bottom absolute inset-0 z-10"></div>
  <div class="relative z-20 flex flex-col justify-end h-full px-16 pb-16">
    <h1 class="text-white text-5xl font-bold leading-tight mb-4">{{ title }}</h1>
    {% if subtitle %}
    <p class="text-white/80 text-xl leading-relaxed max-w-2xl">{{ subtitle }}</p>
    {% endif %}
  </div>
</div>`,

  "quote-slide": `<div class="relative h-full overflow-hidden">
  {% if backgroundImage and backgroundImage.url %}
  <img src="{{ backgroundImage.url }}" alt="{{ backgroundImage.alt | default('') }}" class="absolute inset-0 w-full h-full object-cover" />
  {% else %}
  <div class="absolute inset-0" style="background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
  {% endif %}
  <div class="gradient-overlay-dark absolute inset-0 z-10"></div>
  <div class="relative z-20 flex flex-col items-center justify-center h-full px-20 text-center">
    <div style="font-size: 80px; color: var(--primary-accent-color, #9333ea); opacity: 0.6; line-height: 1;">"</div>
    <blockquote class="text-white text-3xl leading-relaxed max-w-3xl mb-8">{{ quote }}</blockquote>
    <div class="accent-line-center mb-4"></div>
    <p class="text-white text-lg font-semibold">{{ author | default('') }}</p>
    {% if role %}
    <p class="text-white/70 text-base">{{ role }}</p>
    {% endif %}
  </div>
</div>`,

  "chart-slide": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg leading-relaxed mt-3">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center; justify-content: center;">
    <canvas id="chart-{{ _slide_index | default(0) }}" style="max-width: 100%; max-height: 100%;"></canvas>
  </div>
</div>`,

  "table-slide": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg leading-relaxed mt-3">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="rounded-xl border" style="border-color: #e5e7eb;">
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
</div>`,

  "icons-numbers": `{% set m_count = metrics | default([]) | length %}
{% set m_count = m_count if m_count > 0 else 1 %}
<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="text-center" style="margin-bottom: 32px; flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; justify-content: center; align-items: center; overflow: hidden;">
    <div style="display: grid; grid-template-columns: repeat({{ m_count }}, 1fr); gap: 48px; width: 100%; max-width: 1100px;">
      {% for metric in metrics | default([]) %}
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; min-width: 0; overflow: hidden;">
        {% if metric.icon %}
        <div style="font-size: 28px; flex-shrink: 0;">{{ metric.icon }}</div>
        {% endif %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 14px; font-weight: 500;">{{ metric.label }}</div>
        <div style="color: var(--text-heading-color, #111827); font-size: 52px; font-weight: 700; line-height: 1.15;">{{ metric.value }}</div>
        <div style="background: var(--primary-accent-color, #9333ea); border-radius: 8px; padding: 12px 16px; width: 100%; flex-shrink: 0;">
          <p style="color: #ffffff; font-size: 14px; line-height: 1.4;">{{ metric.description }}</p>
        </div>
      </div>
      {% endfor %}
    </div>
  </div>
</div>`,

  "timeline": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: flex; align-items: center;">
    <div style="position: relative; width: 100%;">
      <div style="position: absolute; left: 24px; top: 0; bottom: 0; width: 2px; background: var(--primary-accent-color, #9333ea); opacity: 0.3;"></div>
      <div class="space-y-6">
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

  "process-steps": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
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

  "comparison": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="text-center mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line-center mt-4"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px;">
    <div class="card" style="border-left: 4px solid {{ optionA.color | default('#22c55e') }}; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <h2 style="color: var(--text-heading-color, #111827); flex-shrink: 0;" class="text-2xl font-semibold mb-4">{{ optionA.title | default('Option A') }}</h2>
      <ul style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-3">
        {% for point in optionA.points | default([]) %}
        <li class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: {{ optionA.color | default('#22c55e') }};"></div>
          <span style="color: var(--text-body-color, #4b5563);" class="text-base">{{ point }}</span>
        </li>
        {% endfor %}
      </ul>
    </div>
    <div class="card" style="border-left: 4px solid {{ optionB.color | default('#ef4444') }}; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
      <h2 style="color: var(--text-heading-color, #111827); flex-shrink: 0;" class="text-2xl font-semibold mb-4">{{ optionB.title | default('Option B') }}</h2>
      <ul style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-3">
        {% for point in optionB.points | default([]) %}
        <li class="flex items-start gap-3">
          <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background: {{ optionB.color | default('#ef4444') }};"></div>
          <span style="color: var(--text-body-color, #4b5563);" class="text-base">{{ point }}</span>
        </li>
        {% endfor %}
      </ul>
    </div>
  </div>
</div>`,

  "final-slide": `<div class="flex flex-col items-center justify-center h-full px-16 text-center" style="background: var(--slide-bg-accent-gradient, var(--primary-accent-color));">
  <div class="slide-decor-circle slide-decor-top-right"></div>
  <div class="slide-decor-circle slide-decor-bottom-left"></div>
  <div class="relative z-10 flex flex-col items-center">
  <h1 style="color: #ffffff;" class="text-6xl font-bold mb-4">{{ title | default('Спасибо!') }}</h1>
  <div style="width: 80px; height: 4px; background: rgba(255,255,255,0.5); border-radius: 2px; margin-bottom: 24px;"></div>
  {% if subtitle %}
  <p style="color: rgba(255,255,255,0.85);" class="text-xl leading-relaxed max-w-2xl mb-8">{{ subtitle }}</p>
  {% endif %}
  {% if thankYouText %}
  <p style="color: rgba(255,255,255,0.8);" class="text-lg mb-8">{{ thankYouText }}</p>
  {% endif %}
  {% if contactInfo %}
  <div class="flex flex-col items-center gap-3 mt-8">
    {% for contact in contactInfo %}
    <div class="flex items-center gap-3">
      <span style="color: rgba(255,255,255,0.9);" class="text-lg">{{ contact.value }}</span>
    </div>
    {% endfor %}
  </div>
  {% endif %}
  </div>
</div>`,

  "agenda-table-of-contents": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
  </div>
  <div style="flex: 1 1 0%; min-height: 0; overflow: hidden;" class="space-y-4">
    {% for section in sections | default([]) %}
    <div class="flex items-start gap-6 p-4 rounded-xl" style="background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 5%, white);">
      <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-accent-color, #9333ea); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: white; font-weight: 700;">{{ section.number | default(loop.index) }}</span>
      </div>
      <div>
        <div style="color: var(--text-heading-color, #111827); font-size: 18px; font-weight: 600;">{{ section.title }}</div>
        {% if section.description %}
        <div style="color: var(--text-body-color, #4b5563); font-size: 14px; margin-top: 4px;">{{ section.description }}</div>
        {% endif %}
      </div>
    </div>
    {% endfor %}
  </div>
</div>`,

  "team-profiles": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
    {% if companyDescription %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg mt-3">{{ companyDescription }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: repeat({{ teamMembers | default([]) | length }}, 1fr); gap: 24px; align-items: center;">
    {% for member in teamMembers | default([]) %}
    <div class="card" style="text-align: center; overflow: hidden;">
      <div style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; background: color-mix(in srgb, var(--primary-accent-color, #9333ea) 15%, white);">
        {% if member.image and member.image.url %}
        <img src="{{ member.image.url }}" alt="{{ member.name }}" class="w-full h-full object-cover" />
        {% else %}
        <div class="w-full h-full flex items-center justify-center" style="font-size: 28px; font-weight: 700; color: var(--primary-accent-color, #9333ea);">{{ member.name[0] | default('?') }}</div>
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
</div>`,

  "logo-grid": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6" style="flex-shrink: 0;">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg mt-3">{{ description }}</p>
    {% endif %}
  </div>
  <div style="flex: 1 1 0%; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; align-items: center; justify-items: center;">
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
</div>`,

  "video-embed": `<div class="flex flex-col h-full px-16 pt-10 pb-10">
  <div class="mb-6">
    <h1 style="color: var(--text-heading-color, #111827);" class="text-5xl font-bold">{{ title }}</h1>
    <div class="accent-line mt-4"></div>
    {% if description %}
    <p style="color: var(--text-body-color, #4b5563);" class="text-lg leading-relaxed mt-4">{{ description }}</p>
    {% endif %}
  </div>
  <div class="flex-1 flex items-center justify-center">
    <div class="relative block rounded-2xl overflow-hidden shadow-xl" style="width: 800px; height: 450px;">
      {% if thumbnailImage and thumbnailImage.url %}
      <img src="{{ thumbnailImage.url }}" alt="{{ thumbnailImage.alt | default('Video thumbnail') }}" class="w-full h-full object-cover" />
      {% else %}
      <div class="w-full h-full" style="background: linear-gradient(135deg, #1a1a2e, #16213e);"></div>
      {% endif %}
      <div class="absolute inset-0" style="background: rgba(0,0,0,0.3);"></div>
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl" style="background: var(--primary-accent-color, #9333ea);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
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
.slide .mt-8 { margin-top: 32px; }
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
  const forRegex = /\{%[-\s]*for\s+(\w+)\s+in\s+(.+?)\s*[-]?%\}([\s\S]*?)\{%[-\s]*endfor\s*[-]?%\}/g;
  let result = template;
  let safety = 0;

  while (forRegex.test(result) && safety < 20) {
    safety++;
    result = result.replace(forRegex, (_match, itemVar, listExpr, body) => {
      const list = evalExpression(listExpr.trim(), data);
      if (!Array.isArray(list)) return "";

      return list
        .map((item, index) => {
          const loopData = {
            ...data,
            [itemVar]: item,
            loop: { index: index + 1, index0: index, first: index === 0, last: index === list.length - 1, length: list.length },
          };
          let rendered = processForLoops(body, loopData);
          rendered = processIfBlocks(rendered, loopData);
          rendered = rendered.replace(/\{\{(.+?)\}\}/g, (_m, expr) => {
            try {
              const val = evalExpression(expr.trim(), loopData);
              return val !== undefined && val !== null ? String(val) : "";
            } catch {
              return "";
            }
          });
          return rendered;
        })
        .join("");
    });
    forRegex.lastIndex = 0;
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
  return renderTemplate(template, slideData);
}

export function renderPresentation(
  slides: Array<{ layoutId: string; data: Record<string, any>; html?: string }>,
  themeCss: string,
  presentationTitle: string,
  language: string = "ru",
  fontsUrl?: string,
): string {
  const renderedSlides = slides.map((slide, index) => {
    const html = slide.html || renderSlide(slide.layoutId, { ...slide.data, _slide_index: index });
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
