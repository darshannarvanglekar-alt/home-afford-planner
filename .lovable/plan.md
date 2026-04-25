# Plan: AI-powered bank statement analysis for Step 1

## What will be added

Add a new upload card above the existing Step 1 finance form:

- Heading: "Let AI fill this for you"
- PDF/CSV multi-file upload, up to 6 files
- Per-file validation: PDF or CSV only, max 10MB each
- "Analyse with AI" button with loading spinner
- Privacy copy explaining that files are not stored
- Divider: "or enter manually below"
- Success/error messages that do not block manual entry

## User flow

1. User uploads 1-6 bank statement files.
2. User clicks "Analyse with AI".
3. The app sends the files directly to a backend server function for temporary extraction and analysis.
4. The backend extracts text from CSV/PDF content, calls the AI model using `OPENAI_API_KEY`, and returns structured finance values.
5. Step 1 auto-fills income, commitments, and expense fields.
6. The normal planner auto-save saves only the extracted numbers into the plan data.
7. Uploaded files are cleared from browser state immediately after processing.

## Privacy behavior

- No bank statement file will be uploaded to Lovable Cloud storage.
- No original file will be saved in the database.
- Files are held only in memory during the request.
- The UI will show confirmation after analysis: "File deleted from our servers after analysis."
- Only the extracted numeric fields are persisted in the existing plan JSON data.

## Technical implementation

### Backend analysis function

Create a TanStack Start server function, for example `src/lib/bank-analysis.functions.ts`, that:

- Accepts `FormData` with the selected files.
- Validates:
  - max 6 files
  - each file under 10MB
  - MIME type or filename is PDF/CSV
- Extracts text:
  - CSV: read file text directly
  - PDF: use a Worker-compatible PDF text extraction library if available; otherwise add one that works in this runtime, avoiding Node-only/native packages
- Truncates or guards oversized extracted text to keep the AI request reliable.
- Calls OpenAI using `process.env.OPENAI_API_KEY` from server runtime only.
- Uses model `gpt-4o-mini` per request.
- Sends the exact extraction prompt and requests JSON-only output.
- Parses and validates the AI JSON response with Zod.
- Returns:
  - extracted finance values
  - estimated number of months covered when detectable, otherwise a conservative count based on the uploaded statement span
  - a message-safe error if extraction fails

### Frontend upload UI

Update `src/components/plan/Step1Finances.tsx` to include:

- Upload card above the current heading/manual form.
- Hidden file input plus clickable/droppable dashed upload zone.
- Mobile-friendly file selection with `accept=".pdf,.csv,application/pdf,text/csv"` and `multiple`.
- File list with remove buttons.
- Analyze button state:
  - disabled when no files selected
  - spinner while processing
- Inline validation messages for invalid type/size.
- Success/error messages matching the requested copy.

### Auto-fill and AI badges

Update Step 1 state handling so the upload component can call `onChange` with the extracted values mapped to existing fields:

```text
primarySalary       -> income.primarySalary
additionalIncome    -> income.additionalIncome
familyContribution  -> income.familyContribution
existingEMIs        -> commitments.emis
insurancePremiums   -> commitments.insurance
housingUtilities    -> expenses.housing
familyDependents    -> expenses.family
healthProtection    -> expenses.health
dailyLiving         -> expenses.daily
investmentsSavings  -> expenses.investments
discretionary       -> expenses.discretionary
```

Track which fields were AI-filled in local Step 1 UI state and render:

- subtle indigo left border around AI-filled field wrappers
- small "AI" badge near each auto-filled label
- all fields remain editable

If a user edits a field manually after AI-fill, I will keep the AI badge visible for that session to show the source of the initial value, unless you later want it cleared on edit.

## Important note about secrets

I will use `OPENAI_API_KEY` only on the backend. It will not be exposed to client code and will not use a `VITE_` prefix.

If the secret is not actually present at implementation time, the UI can be built, but the analysis call will return a friendly configuration error until the secret is added in Lovable Cloud secrets.

## Files likely to change

- `src/components/plan/Step1Finances.tsx`
- `src/lib/bank-analysis.functions.ts` or similar new server-function file
- `src/lib/plan-schema.ts` for the extracted JSON validation/mapping types
- `package.json` / lockfile only if a PDF text extraction package is needed

## Not included

- No file storage bucket
- No database schema changes
- No storage of original bank statements
- No changes to the existing manual Step 1 calculations beyond auto-filling values