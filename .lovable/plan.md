

## Update Progress Page Tier Gating

### Changes — single file: `src/pages/Progress.tsx`

1. **Wrap `PhotoRecognition` in Pro gate** (line 73):
   ```jsx
   <TeaserGate requiredTier="pro" featureName="Snap & Log">
     <PhotoRecognition />
   </TeaserGate>
   ```

2. **Wrap `BarcodeScanner` in Pro gate** (line 76):
   ```jsx
   <TeaserGate requiredTier="pro" featureName="Scan Barcode">
     <BarcodeScanner />
   </TeaserGate>
   ```

3. **Keep `VoiceRecognition` ungated** (line 79) — free for all tiers, uses local on-device parser.

4. **Make Diet Trends free, gate other categories** (lines 82-104):
   - Remove the outer `<TeaserGate>` that wraps the entire category dropdown + CategoryView block
   - Always render the `<Select>` dropdown so users can see all categories
   - Conditionally gate `<CategoryView>`: if `category !== "diet_trends"`, wrap it in `<TeaserGate requiredTier="pro" featureName="Advanced Progress Charts">`, otherwise render it directly

### Access Summary

| Feature | Tier |
|---------|------|
| Nutrient Breakdown | Free |
| Diet Trends chart + Add Entry | Free |
| Smart Log (text + voice, local parser) | Free |
| Snap & Log (PhotoRecognition) | Pro |
| Scan Barcode (BarcodeScanner) | Pro |
| Other progress categories (body, vitals, etc.) | Pro |

