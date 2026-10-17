# Content and picture-library review

Reviewed October 1, 2026. These notes are for design and content review, outside the patient interface.

## Relaxation content

The breathing guide uses five seconds in and five seconds out, without breath holds. It offers one-, three- and five-minute presets plus a custom minutes field with dictation. It supports pause, resume, restart and reduced motion, and pauses when the page is hidden. The duration and visual pace are prototype choices.

Visualization offers six illustrated scenes with drop-in narration files. See `public/audio/visualization/README.md` for filenames.

On October 16, 2026, the owner selected [Eleni Fit's stretching video](https://www.youtube.com/watch?v=48jIXvwXmeQ) to replace the previous CUH video. YouTube metadata identifies Eleni Fit as its creator. The app keeps manual loading, no autoplay, an external YouTube link, and a reminder to use only therapist-approved movements. The video is embedded, not downloaded or rehosted.

## Future picture libraries

| Library | Fit | Licensing considerations | Next step |
| --- | --- | --- | --- |
| [ParticiPics — Aphasia Institute](https://www.aphasia.ca/participics/) | Strongest audience match: developed specifically to support conversations with adults with aphasia. | The public page permits creating clinical resources and requests acknowledgement for published materials. It does not clearly settle broad commercial app redistribution/offline bundling. | Ask the Institute about this app's distribution model before bundling. Trial a small sample with patients. |
| [Widgit symbol licensing](https://www.widgit.com/symbol-services/licensing.htm) | Large symbol vocabulary with a documented software/app licensing path. | Negotiated licence; costs and royalties depend on the intended use. A standard authoring-tool subscription is not blanket redistribution permission. | Request a test set and an app-specific quote; assess adult relevance with users. |
| [ARASAAC](https://arasaac.org/terms-of-use) | Broad AAC pictogram catalogue useful for many daily activities. | Pictograms are identified as CC BY-NC-SA: attribution, noncommercial use, and share-alike restrictions matter. See also the official [pictographic-system explanation](https://aulaabierta.arasaac.org/en/arasaac-pictographic-system-of-reference-in-the-aac). | Consider for a compatible noncommercial prototype; obtain permission for uses outside the licence. |
| [Lucide](https://lucide.dev/guide/lucide) | Current consistent interface icons. These are general UI icons, not an aphasia-tested communication system. | ISC licence; keep the applicable notices. | Retain for navigation while evaluating a dedicated activity-picture library. |

## unDraw artwork used in the prototype

Activity illustrations in `public/illustrations/` come from unDraw: Walking outside, Book lover, Eating pasta, Listening, Coffee with friends, Alarm clock, Creative drawing, Video game night, Sweet home, Morning workout, Career growth, Cooking, Online groceries, and Mindfulness. Their accent color is adjusted to match the app's green activity and blue mindfulness sections. unDraw's [license](https://undraw.co/license) grants free use, modification, and distribution without attribution, while its rule-of-thumb cautions against making unDraw illustrations the center of an app. Treat these as prototype artwork and verify the intended release/distribution model before shipping. The illustrations are decorative design assets, not aphasia-tested communication symbols.

No close unDraw illustration was selected for Personal care, general Out & about activities, or arbitrary custom activity names; these keep the existing Lucide symbols. Visualization currently reuses the Mindfulness illustration. Recommendation: evaluate ParticiPics with the intended audience; consider Widgit for a commercial app licence.

## Handcrafts icon review

The [Handcrafts catalogue](https://handcrafts.undraw.co/app) has similar icons for arrows, checks, hearts, smiley faces, clocks, and plus controls. It does not list clear equivalents for the app's calendar, settings, home, pencil, trash, play/pause, or time-of-day icons. The [Handcrafts license](https://handcrafts.undraw.co/license) cautions against using its artwork at the center of an app. Pictures are central to this app's aphasia interface, so Handcrafts assets were not bundled. Seek permission from the creator before using them as this app's icon system; keep the current Lucide controls for now.
