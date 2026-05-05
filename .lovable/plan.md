## Change

Switch `public/feature-graphic.png` generation from SVG/sharp compositing to a pure AI image generation using Lovable AI Gateway (Nano Banana Pro: `google/gemini-3-pro-image-preview`).

## Implementation

Rewrite `scripts/generate-feature-graphic.mjs`:
- Remove all sharp/SVG composition, hero-image loading, font handling, and resvg usage.
- Call `https://ai.gateway.lovable.dev/v1/chat/completions` with `modalities: ["image", "text"]` and a detailed prompt describing:
  - 1024×500 landscape banner
  - Dark left text zone (#0e0c09), 5px amber bar (#e8821a)
  - Cinematic muscular back/shoulders photo on the right with smooth fade to dark
  - Wordmark "CARNIVOREX" — small uppercase, weight 900, 0.3em tracking, white with amber X
  - Headline "Health is Wealth." in warm white
  - Subtitle "Let food be your medicine — meat heals." in muted gray
  - Three amber pill badges: Lion Diet, Strict Carnivore, Animal-Based
- Parse `data.choices[0].message.images[0].image_url.url`, base64-decode, then use sharp ONLY to enforce exact 1024×500 (`fit: cover`) and write PNG to `public/feature-graphic.png`.
- Use `LOVABLE_API_KEY` from env.

Run `node scripts/generate-feature-graphic.mjs` with `LOVABLE_API_KEY` and verify dimensions are 1024×500.