# Content and picture-library review

Reviewed September 28, 2026. These notes are for design and content review, outside the patient interface.

## Relaxation content

The breathing guide uses a one-minute visual cycle: five seconds in and five seconds out, without breath holds. It has start, pause, resume, restart, and reduced-motion support. It pauses when the page is hidden. This is a visual design trial, not a prescribed pace or treatment. The instructions emphasize gentle, unforced breathing. The [NHS breathing guidance](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/) supports gentle breathing and optional counting; the one-minute duration is our prototype choice, not that source's suggested practice duration.

The videos below are sourced from health providers. Neither is claimed to be clinically validated for aphasia. People with aphasia have different language comprehension and mobility needs; review the specific videos with the intended participants and their clinician before clinical use. The iframe requests English captions where available; captions are not guaranteed by that setting. Videos load only on request, do not autoplay, and have a separate YouTube link if embedding is blocked. No video is downloaded or rehosted.

| Screen | Selected source | Selection reasoning and limitations |
| --- | --- | --- |
| Visualization | [Relaxation and visualisation — Herefordshire & Worcestershire Health and Care NHS](https://www.youtube.com/watch?v=0TUq88f0jn4) | Health-provider relaxation resource. The selected video is 4:47 long and YouTube currently reports captions unavailable. Guided visualization depends on understanding spoken language; this is a candidate for supported use and review, not an aphasia-specific endorsement. |
| Gentle stretching | [Seated stretches — Cambridge University Hospitals](https://www.cuh.nhs.uk/our-services/physiotherapy-outpatients/outpatient-physio-resources/resources/shoulder/seated-stretches/) — [upper back and shoulders video](https://www.youtube.com/watch?v=GcPujVayIbI) | A short seated demonstration with an accompanying transcript. Selected over longer, more equipment-heavy routines. The in-app reminder limits use to therapist-approved movements, especially where stroke affects shoulder movement. |

Also considered: [American Stroke Foundation seated stretching](https://afterstroke.org/spasticity-stroke-seated-stretching-routine/). It addresses stroke, but has a longer routine and additional equipment, so the shorter CUH demonstration was selected for this initial interface.

## Future picture libraries

| Library | Fit | Licensing considerations | Next step |
| --- | --- | --- | --- |
| [ParticiPics — Aphasia Institute](https://www.aphasia.ca/participics/) | Strongest audience match: developed specifically to support conversations with adults with aphasia. | The public page permits creating clinical resources and requests acknowledgement for published materials. It does not clearly settle broad commercial app redistribution/offline bundling. | Ask the Institute about this app's distribution model before bundling. Trial a small sample with patients. |
| [Widgit symbol licensing](https://www.widgit.com/symbol-services/licensing.htm) | Large symbol vocabulary with a documented software/app licensing path. | Negotiated licence; costs and royalties depend on the intended use. A standard authoring-tool subscription is not blanket redistribution permission. | Request a test set and an app-specific quote; assess adult relevance with users. |
| [ARASAAC](https://arasaac.org/terms-of-use) | Broad AAC pictogram catalogue useful for many daily activities. | Pictograms are identified as CC BY-NC-SA: attribution, noncommercial use, and share-alike restrictions matter. See also the official [pictographic-system explanation](https://aulaabierta.arasaac.org/en/arasaac-pictographic-system-of-reference-in-the-aac). | Consider for a compatible noncommercial prototype; obtain permission for uses outside the licence. |
| [Lucide](https://lucide.dev/guide/lucide) | Current consistent interface icons. These are general UI icons, not an aphasia-tested communication system. | ISC licence; keep the applicable notices. | Retain for navigation while evaluating a dedicated activity-picture library. |

Recommendation: first evaluate ParticiPics with the intended audience; consider Widgit for a commercial app licence. No accounts, purchases, licence agreements, outreach, or third-party picture downloads were made during this task. Current activity choices still use Lucide icons paired with words.
