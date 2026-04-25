# Plan: AI-powered builder payment plan extraction

## What will be added

On Step 2 — Your Home, inside the existing Builder Payment Plan section for "Home — Under Construction", add an upload card above the manual stage table:

- Heading: "Upload your builder payment schedule"
- Subheading explaining PDF/image upload and auto-fill
- Dashed upload box for PDF, JPG, and PNG files
- Mobile-friendly controls:
  - "Take a Photo" using camera capture
  - "Choose File" using file picker
- "Extract Payment Plan" button with loading spinner
- Support text for allotment letters, payment schedules, and demand letters
- Divider: "or enter stages manually below"
- Success/error/privacy messages that do not block manual editing

## User flow

1. User selects "Home — Under Construction" in Step 2.
2. User uploads a builder payment schedule PDF or image.
3. User clicks "Extract Payment Plan".
4. The app sends the file directly to a backend route for temporary analysis.
5. The backend extracts text for PDFs, or sends images to GPT-4o mini vision.
6. The backend returns structured payment stages, and optionally property cost if found.
7. The existing builder stage rows are replaced with the extracted rows.
8. If property cost is found and the current property cost is empty, it is auto-filled.
9. The normal Step 2 auto-save persists only the extracted numbers and stage labels.
10. The selected file is cleared from browser state after processing.

## Privacy behavior

- No uploaded builder document will be saved to storage.
- No original PDF/image will be saved in the database.
- Files are held only in memory during the request.
- The UI will show: "Document deleted after analysis."
- Only extracted stage data, and property cost if applicable, are saved through the existing plan auto-save.

## Backend implementation

Create a new authenticated API route, likely:

```text
src/routes/api.extract-builder-payment-plan.ts
```

It will:

- Require the signed-in user, matching the existing bank-statement analysis route pattern.
- Accept one uploaded file via `FormData`.
- Validate:
  - PDF, JPG, JPEG, or PNG only
  - max 10MB
- For PDFs:
  - Extract text using the existing lightweight PDF text extraction approach used by bank-statement analysis.
  - Send extracted text plus current property cost to OpenAI GPT-4o mini.
- For images:
  - Convert to base64 data URL.
  - Send to GPT-4o mini as an image input with the requested extraction prompt.
- Request JSON-only output.
- Parse and validate a JSON response shaped like:

```text
{
  stages: [
    {
      stageName: string,
      month: number,
      bankAmount: number,
      selfAmount: number,
      totalAmount: number
    }
  ],
  propertyCost?: number
}
```

A wrapper object will be used internally because JSON mode is more reliable with objects than a bare top-level array. The route will still enforce the user-facing rule that stages are the extracted array.

## Frontend implementation

Update `src/components/plan/Step2Home.tsx` to:

- Add local state for:
  - selected file
  - drag/drop active state
  - loading state
  - success/error messages
  - AI-filled stage row IDs
- Add desktop and mobile upload controls.
- Use `accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"`.
- Use a separate mobile camera input with `capture="environment"`.
- On extraction success:
  - replace `builderStages` with extracted rows mapped to existing fields:

```text
stageName  -> name
month      -> month
bankAmount -> bankPays
selfAmount -> youPay
```

- Auto-fill `propertyCost` only when it is currently empty and the backend found a valid cost.
- Show: "Found [X] payment stages. Please review and edit if anything looks wrong."
- Show: "Document deleted after analysis."
- Highlight AI-filled rows with a subtle indigo left border and an "AI" badge.
- Keep all extracted rows fully editable.

## Error handling

The UI will show friendly messages for:

- Empty extracted result: "We couldn't find a payment schedule in this document. Please enter the stages manually below."
- Unreadable image or PDF: "The image quality is too low to read. Please try a clearer photo or upload the PDF directly."
- Invalid file type: "Please upload a PDF, JPG or PNG file only."
- File over 10MB: "File too large. Please upload under 10MB or take a photo instead."
- AI/provider failure: a non-blocking manual-entry fallback message.

## Technical notes

- Uses the existing `OPENAI_API_KEY` backend secret.
- No database schema changes are required.
- No storage bucket is required.
- The existing Step 2 auto-save will persist the updated `home.builderStages` and optional `home.propertyCost`.
- I will not edit generated integration/type files or `routeTree.gen.ts`; route registration will be handled by the TanStack router tooling.

## Files likely to change

- `src/components/plan/Step2Home.tsx`
- `src/routes/api.extract-builder-payment-plan.ts` (new)
- `src/lib/plan-schema.ts` only if shared extraction validation types are useful

## Not included

- No permanent document storage
- No file storage bucket
- No database schema changes
- No changes to Step 4 calculations beyond using the existing builder stage data already saved in the plan