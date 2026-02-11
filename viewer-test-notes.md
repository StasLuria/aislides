# Viewer Test Notes

## Generated Presentation Structure
- Title: "Машинное обучение"
- 9 slides auto-determined by AI
- Slide types observed:
  - Slide 1: title-slide (image-text layout with placeholder image icon)
  - Slide 2: text-slide (bullet points)
  - Slide 3: two-column layout
  - Slide 4: process-steps
  - Slide 5: image-text with cards
  - Slide 6-9: various layouts

## HTML Structure
- Each slide is a `<section class="slide-container">` 
- Slides have `data-slide-number` attribute
- Each slide has a `.slide-header` with "Slide X / Y"
- Slide content is inside the section

## Issues to check in Viewer
- Viewer needs to parse these sections correctly
- Thumbnails need proper scaling with transform: scale()
- Main slide iframe needs to show the correct slide
