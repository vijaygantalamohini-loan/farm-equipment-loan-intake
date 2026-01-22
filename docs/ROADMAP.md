# Roadmap

This roadmap is derived from TODOs and placeholders in the current codebase.

## Planned

<!-- AUTO-GENERATED: ROADMAP_PLANNED_START -->
- Add API rate limiting middleware (noted as TODO in `loan-intake-backend/ARCHITECTURE_AZURE_AD.md`).
- Wire lender preference UI to the backend (TODO in `loan-intake-frontend/src/components/LenderPreferences.js`):
  - Persist preferences via `POST /lenders/{id}/preferences`.
  - Load existing preferences via `GET /lenders/{id}/preferences`.
<!-- AUTO-GENERATED: ROADMAP_PLANNED_END -->

## Placeholder data to replace

<!-- AUTO-GENERATED: ROADMAP_PLACEHOLDERS_START -->
- Replace `SAMPLE_LENDERS` in `loan-intake-frontend/src/components/LenderPreferences.js` with real lender data from `/lenders`.
<!-- AUTO-GENERATED: ROADMAP_PLACEHOLDERS_END -->
