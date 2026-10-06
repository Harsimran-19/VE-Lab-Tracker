# Sign-in design verification

final result: passed

This is an implementation QA result, not user approval. The user approved only the original generated reference and subsequently rejected earlier implementation drift.

## Source and evidence

- Approved source: `/Users/harsimran/.codex/generated_images/01a10d07-f5b7-7382-bec4-4a4e14d748de/exec-4b7e0f6b-1331-4def-ba7b-2a71507ca482.png`, 1586 × 992 pixels.
- Reference rendered in the same browser: `/private/tmp/ve-sign-in-qa/reference-browser.png`, 1586 × 992. Image bounding box verified at x0/y0, 1586 × 992.
- Implementation: `/private/tmp/ve-sign-in-qa/reference-size-final.png`, 1586 × 992 CSS viewport and pixels, density 1.
- Full comparison: `/private/tmp/ve-sign-in-qa/comparison-final.png`, reference on left, implementation on right. Both captured through the same browser for consistent colour handling.
- Wide-screen evidence: `/private/tmp/ve-sign-in-qa/wide-final.png`, 1900 × 989 CSS pixels; this matches the proportions of the user's 3800 × 1978 screenshot at density 2. The artwork panel is 967.0625 × 989, preserving 970:992 source aspect ratio.
- Mobile evidence: `/private/tmp/ve-sign-in-qa/mobile-final.png`, 390 × 844 CSS viewport and pixels; no horizontal or vertical overflow.
- Earlier focused form comparison: `/private/tmp/ve-sign-in-qa/form-comparison.png`; the authentication form is unchanged in this correction.

## Findings and fixes

1. Earlier extraction regenerated the sculpture and changed its blue tone. This was a substantive P1 mismatch, not acceptable production variation. The final asset retains original source pixels outside the branding area. Only the existing title region uses Image Gen's text removal, with a feathered boundary. Original sculpture pixels below the title region are unchanged. No generated upscale was used: its geometry drift was rejected.
2. `object-fit: cover` and a fixed 61.2% panel enlarged and cropped the sculpture on the user's wider screen. Replaced with `object-fit: contain` and a panel width bounded by the source aspect ratio and viewport height. At reference proportions the original split is preserved; wider screens show the entire artwork at the same height without enlargement to fill width. Mobile preserves source aspect ratio and fits within the screen.
3. Changed the name to **Venture Engineering Lab Tracker** as requested. Source Serif 4 regular is locally hosted for the title and welcome heading; IBM Plex Sans for controls and copy. The smaller name layout stays clear of the orbital lines. No initials, portraits, product logo or app navigation appears.
4. Text-removal patch initially missed descenders from the original name. Expanded the patch within the empty branding region and recaptured. No residual letters remain.

## Required fidelity surfaces

- Typography: correct requested product name; Source Serif 4 regular display type and IBM Plex Sans interface type. Sentence case and proper product-name capitalization. Name wrapping deliberately changes to accommodate the longer corrected name.
- Layout: complete sculpture visible at reference and supplied wide-screen proportions, clear title space, directly placed sign-in form on white, no authentication card. Mobile adaptation has no overflow.
- Colours: original artwork RGB values retained. Comparing the reference and implementation through the same browser removes capture-profile differences: an unchanged blue sample at x40/y240 is [169,189,222] in both browser captures. No CSS tint or filter is applied to the artwork.
- Image quality: lossless 970 × 992 PNG with explicit sRGB profile, served directly without Next image recompression. Full image fits rather than being enlarged to cover. The source itself is raster; no invented high-resolution geometry is substituted.
- Content: corrected product name plus the selected welcome, description, Google sign-in and first-time account copy. Google authentication and callback behavior remain unchanged.

## Validation and limits

Production build and TypeScript pass. Browser console has no errors. Existing 48 tests passed before these presentation-only corrections. Real Google OAuth completion was not performed; the local visual preview uses placeholder credentials. No deployment was performed. The original source has finite raster resolution; the implementation preserves it rather than inventing details.

## Follow-up polish

Minor font-shape differences from image-generated lettering remain; the implementation uses the explicit design.md font family. No remaining P0/P1/P2 findings in the compared states. Acceptance of the rendered page remains with the user.

## Remaining workspace pages — October 6, 2026

Implemented Projects, project Overview/Updates/Resources/People, Team, member pages, Account, manager reporting settings, onboarding, and the existing project, responsibility and weekly-update editors. These use the selected image direction and design.md fonts/palette. User-requested adjustments are intentional: 38px desktop headings, 31px mobile headings, 14–15px UI text, dark project names and person outline icons. Product branding is Venture Engineering Lab Tracker; no product monogram or sharing control is present. A Phosphor clipboard browser icon was added.

### Comparison evidence

Desktop captures use a 1487 × 1058 CSS viewport. Source-left/implementation-right pairs are saved under `/private/tmp/ve-rest-qa/`: `projects-comparison.png`, `project-comparison.png`, `team-comparison.png`, `account-comparison.png`, `onboarding-comparison.png`. Sources are the previously selected generated images: Projects `exec-c6e17aa1-67f0-41ac-96e5-fa0e0aef1fca.png`; workspace `exec-b4d28053-4fb6-4b05-830f-f6a8b693b831.png`; Team `exec-dd49d994-a23d-49dc-859c-b4fab048075f.png`; Account `exec-2f6527b8-2336-4e9b-82c5-5cf790634938.png`; onboarding `exec-49216e82-089c-4a19-a7d5-64748f5fb849.png`. Source images are normalized to the capture dimensions for comparison, not served as page backgrounds.

The structure, fonts, palette, navigation, table hierarchy, form hierarchy and project sections were inspected together with their references. Demo values differ from reference examples. The local-preview banner is development-only. Sign out is hidden in the demo, available with real authentication. Project and responsibility editors remain accessible native dialogs rather than introducing separate editor routes. Existing statuses remain Not started/In progress/Blocked/Done. Publication fields are expandable; required and important project fields are visible immediately.

### Findings repaired

- Removed legacy account navigation, card grids, initial avatars and uppercase brand labels from remaining screens.
- Kept project names dark and separated project content into four functional tabs.
- Repaired onboarding header width and inherited alignment/colour styles.
- Paired milestone/date fields and aligned optional field labels.
- Replaced a mobile phase strip that hid the current phase with a two-row phase layout.
- Added mode-specific resource/publication/collaborator empty states.
- Matched Account's separate Profile and Reminders sections with an accessible reminder switch.

### Verification

Production build, TypeScript and all 48 existing unit tests pass. Local browser checks verified project creation with phase, weekly update submission and display in Updates, profile saving, onboarding selection/completion, resource and collaborator tabs, member navigation, and manager settings. Console error log was empty. Mobile screenshots at 390 × 844 are `mobile-projects.png`, `mobile-project.png`, `mobile-form.png`, `mobile-account.png`, `mobile-team.png`; document width is 390px for checked Projects, Account and Team states. Dialogs retain sticky actions and scrollable content. No live sheet data was modified and no real reminder email sent. Real Google OAuth and production delivery were not exercised. The old Playwright CLI suite was not run; interaction checks used the local browser demo.

No unresolved blocking layout issue in the inspected states. Smaller typography and dynamic data are intentional departures from generated mockups. User acceptance remains pending; this report does not label the implementation approved.

## Loader and header alignment — October 6, 2026

Added a visible animated Phosphor spinner to the root Next.js loading fallback, with matching Source Serif 4/IBM Plex Sans fonts, a clear status message and reduced-motion support. Extracted shared font declarations so the server-rendered loader uses the same type as the workspace. Removed sidebar-based header indentation: the product title now starts 24px from the desktop left edge and 16px on mobile. Browser measurement confirmed x=24px; loader animation confirmed `workspace-loading-spin` at 1s. Screenshots: `/private/tmp/ve-header-fixed.png` and `/private/tmp/ve-loader.png`. The temporary loader inspection route was removed after verification. TypeScript and production build pass.
