# Craneyadak visual identity — product images and video

Status (29 Mehr 1405): **the image design pipeline is owned by the client and Gemini** and is being redesigned. The programmatic
compositor that lived in this repository was removed at the client's decision (its output looked boxy). This document keeps only the
rules every product image must follow — whatever tool produces it — because they protect SEO, trust and project rules 2 and 9.

## 0. Hard rules (they protect the SEO and trust value of the site)

1. **The part in the picture must be the real part.** AI may change background, light, shadow and framing. It must never
   change the part: shape, holes, pins, label text, part number, logo, connector, proportions, colour.
   A fully AI-generated part is an illustration, not a product photo → label it «تصویرسازی» and never use it as the
   product image (project rule 9; also never in JSON-LD `image`).
2. **Keep the raw originals forever**, untouched, in a separate folder. They are your evidence and your re-do source.
3. **Every product gallery keeps one unretouched close-up** of the label / part number next to the branded hero image.
   The brand look sells; the raw close-up proves.
4. **Phone number, logo and text are added by a template, never by the AI.** Image models garble digits and Persian text.
   A wrong digit in a phone number is worse than no number.
5. No official-dealer claims in any image or video (rule 3). «قطعه اصلی با ضمانت اصالت» is allowed only on products that
   carry the «اصلی» label on the site.

## 1. What the site needs from every image

- Product gallery images: real photo of the real part, long side ≤ 1600 px before upload (the build converts to AVIF/WebP), fixed aspect
  ratio per gallery so layout never shifts (CLS 0). The Frontend v2 gallery frame is a neutral `steel-50`/white container.
- Optional helper in the repo: `npm run cutout -- raw.jpg cut.png` (`scripts/cutout.swift`, Apple Vision) removes the background of a raw
  photo with a mask only — the part's pixels are untouched. Any design tool may take the transparent PNG from there.

## 2. Image pipeline

Owned by the client (with Gemini). Whatever the tool, the output is checked against §0 and §4 before upload.

## 3. Video pipeline (motion graphics + human voice)

Split by what each tool is reliable at:

| Layer | Tool | Why |
|---|---|---|
| Camera move around a real still (slow push-in, orbit, light sweep) | Flow (Veo), «Ingredients to Video»: up to 3 reference images per prompt (approved product still + style reference) | Keeps the look; use short clips |
| Text, numbers, phone, logo, Persian typography, callouts | Video editor (CapCut / DaVinci / Premiere) from a saved template | Video models do not render these reliably |
| Voice | **Human voice, always the same person**, recorded once per video | Brand consistency; check any AI voice for Persian quality before using it |
| Music and sound sting | One fixed track + a 1-second logo sting | Same audio signature every time |

Template for a 20–30 s product video (same skeleton every time):

1. 0–2 s: logo sting on graphite backdrop.
2. 2–10 s: the part, slow camera move (Veo from the approved still).
3. 10–22 s: 3 callouts as animated lines in accent orange: what it is, which cranes/brands it fits, guarantee wording **only if approved for that category**.
4. 22–28 s: `craneyadak.com` + phone, orange strip, voice reads the call to action.
5. Formats: 16:9 for the site/YouTube/Aparat, 9:16 for Instagram/Reels from the same edit.

Cautions: Veo can invent moving parts or change geometry. Review every clip frame by frame against the raw photo. Use Veo only for
camera motion and mood, never to show how a part works. Do not use generated audio for the voice track.

## 4. File naming and SEO details

- File: `{sku}-{brand}-{view}-{nn}.jpg`, lowercase Latin, e.g. `saga1-l12-saga-front-01.jpg`. Max 1600 px long side before upload
  (build converts to AVIF/WebP).
- Alt text (Persian, factual, one sentence, no keyword stuffing): «ریموت کنترل SAGA1-L12 ساگا، نمای روبه‌رو».
- First gallery image = branded hero. Last = unretouched label close-up. The site's JSON-LD `image` may use a retouched real photo;
  it must never use an illustration.
- A phone number drawn on an image is not text Google reads; the phone number must also exist as real text on the page (it does: header, footer, contact).

## 5. Per-image checklist (reject on any "no")

- [ ] Part shape, holes, pins and connectors identical to the raw photo?
- [ ] Label text and part number identical (zoom 100 %)?
- [ ] Colours of the part unchanged (not glossier, not darker)?
- [ ] No added or missing screws, wires, stickers?
- [ ] Every number, phone and Persian word on the image correct (typed, never AI-drawn)?
- [ ] Long side ≤ 1600 px, named per §4?
