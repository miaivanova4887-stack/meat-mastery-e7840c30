I’ll correct the feature graphic wordmark by using the actual in-app `CarnivoreXLogo` styling as the source of truth instead of the current custom SVG text rendering.

Plan:
1. Update `scripts/generate-feature-graphic.mjs` so the wordmark matches the app logo:
   - Text: `Carnivore` + amber `X`, uppercased by styling rather than hardcoded differently.
   - Font: Inter ExtraBold/Black, matching the app’s `font-extrabold` look.
   - Letter spacing: `0.3em`, matching `tracking-[0.3em]`.
   - Color: white wordmark with the app primary amber for the `X`.
2. Fix the wordmark rendering issue by generating the logo as a raster image from an HTML/CSS render of the real logo styling, not by hand-tuning SVG text metrics.
3. Keep the male hero visual from the previous version: `src/assets/hero-athletic.jpg`.
4. Keep the requested larger logo scale, but adjust width/position as needed so the full wordmark reads correctly and doesn’t get clipped or distorted.
5. Regenerate `public/feature-graphic.png` at the required 1024×500 size.
6. Verify the final PNG dimensions and visually inspect the generated output to confirm:
   - The wordmark spelling and casing are correct.
   - The `X` is amber.
   - The logo is 2× sized compared with the earlier small version.
   - The male visual remains in place.

Technical details:
- I’ll replace the fragile `Resvg` wordmark block in the generator with an image-rendering step that mirrors the React/Tailwind logo classes (`inline-flex`, `items-baseline`, `leading-none`, `tracking-[0.3em]`, `uppercase`, `font-extrabold`).
- The final asset will still be composed with Sharp and saved as `public/feature-graphic.png`, so the Play Store image remains a normal PNG image, not an SVG.