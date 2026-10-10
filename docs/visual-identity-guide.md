# Craneyadak visual identity — image and video production guide

Status: v0 draft (18 Mehr 1405). Owner: client. Tools: Gemini (Nano Banana image models) and Google Flow (Veo video).
Freeze the style sheet as **v1** after the 3-product pilot (step 6). Changing it later means redoing every asset.

> Capabilities below come from public Google pages and third-party guides read on 2026-10-10. Reference-image limits and
> Gem behaviour differ between sources and between plans. **Test each claim in your own account before relying on it.**

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

## 1. The style sheet (decide once, write it down)

Use the site's own tokens so photos and pages look like one system (`src/styles/global.css`):

| Element | Decision |
|---|---|
| Backdrop | Dark graphite gradient, `#171B1F` (steel-900) centre to `#0E1113` (steel-950) edge. One backdrop for all products. |
| Accent | Orange `#EA580C`, used only for: thin rule under the part, phone strip, small corner mark. Nothing else orange. |
| Light | One soft key light from upper-left, soft contact shadow under the part, faint rim light. No coloured gels. |
| Camera | Straight-on or 3/4 view, part centred, 10–12 % safe margin on every side, same scale feel across products. |
| Canvas | Square 1:1, 1600×1600 px for gallery. Social variants cropped from the same master (4:5, 9:16). |
| Footer strip | Bottom 8 % of canvas: brand mark on the right (RTL start), `craneyadak.com` and phone in Vazirmatn. Outside the part area. |
| Never | Hands, people, fake workshops, invented environments, lens flare, stock cranes behind the part, text inside the part area. |

Phone number in every image — your idea works if done as a **template layer**:

- Put **`craneyadak.com`** as the permanent mark and the phone beside it. The number is then one text layer you can change once and re-export.
- Cost to know: if the number changes you re-export every image. Template + batch export keeps that to minutes.
- Google Merchant-style image policies forbid promotional overlays on the main product image. That programme is not
  available in Iran, so it does not bind you, but keep the strip small and outside the part so a clean crop is always possible.

## 2. Image pipeline (raw photo in → branded image out)

1. **Prepare the raw photo.** Sharp, whole part visible, plain background if possible, 2000 px or larger. Do not pre-filter.
2. **Pass 1 in Gemini — cut-out only.** Upload the photo, ask to remove only the background and keep the part pixel-faithful.
   Change one thing per pass. Combining background, light and angle in one pass causes the part to drift.
3. **Pass 2 in Gemini — place on the brand backdrop.** Attach: the cut-out, plus your **approved master image** as style anchor.
4. **Check at 100 % zoom against the raw photo** (checklist in section 5). Reject and redo on any change to the part.
5. **Template in Canva / Figma / Photoshop:** drop the result in, footer strip with brand + site + phone. Export 1600×1600.
6. **Save:** raw → `raw/`, branded master → `branded/`. Upload the branded image to WordPress; keep the raw close-up as the last gallery image.

Prompt skeleton for pass 2 (English works best; the text on the part stays whatever the photo shows):

```
Image 1 is a real product photo of a crane spare part (already cut out). Image 2 is the approved brand style reference.
Task: place the part from image 1 on a backdrop that matches image 2: dark graphite gradient, one soft key light from
upper-left, soft contact shadow, faint rim light, part centred with 10% margin.
Keep the part exactly as in image 1: same shape, proportions, holes, connectors, label text, part number and colours.
Do not add, remove or redraw any detail on the part. Do not add text, logos, hands or other objects.
Output: square 1:1.
```

Gemini setup that makes this repeatable:

- Create a **Gem** (Gemini → Gems → New Gem) holding the style sheet and the skeleton above. Sources disagree on whether a Gem can
  default to «Create image»; if not, pick the tool manually inside the Gem chat.
- Use the best image model your plan offers (the «Thinking»/Pro tier when you attach several references). The cheapest «Fast» tier is
  described by Google as not optimised for multiple references or multi-step editing.
- **Master image first.** Make one perfect branded image of one product, approve it, then attach it as a reference in every later job.
  Consistency comes from the anchor image, not from the words.
- Do not describe the part in the prompt beyond what is needed. Describing it invites the model to "improve" it.

## 3. Video pipeline (motion graphics + human voice)

Split by what each tool is reliable at:

| Layer | Tool | Why |
|---|---|---|
| Camera move around a real still (slow push-in, orbit, light sweep) | Flow (Veo), «Ingredients to Video»: up to 3 reference images per prompt (your branded master + style anchor) | Keeps the look; use short clips |
| Text, numbers, phone, logo, Persian typography, callouts | Video editor (CapCut / DaVinci / Premiere) from a saved template | Video models do not render these reliably |
| Voice | **Human voice, always the same person**, recorded once per video | Brand consistency; check any AI voice for Persian quality before using it |
| Music and sound sting | One fixed track + a 1-second logo sting | Same audio signature every time |

Template for a 20–30 s product video (same skeleton every time):

1. 0–2 s: logo sting on graphite backdrop.
2. 2–10 s: the part, slow camera move (Veo from the branded still).
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
- The phone strip is not text Google reads; the phone number must also exist as real text on the page (it does: header, footer, contact).

## 5. Per-image checklist (reject on any "no")

- [ ] Part shape, holes, pins and connectors identical to the raw photo?
- [ ] Label text and part number identical (zoom 100 %)?
- [ ] Colours of the part unchanged (not glossier, not darker)?
- [ ] No added or missing screws, wires, stickers?
- [ ] Backdrop, light, margin, canvas match the master?
- [ ] Footer strip text and digits correct (from template)?
- [ ] File size sensible, 1600 px, named per section 4?

## 6. Rollout order

1. Write the style sheet (section 1) and save the master image of one product.
2. **Pilot with 3 very different parts** (a remote controller, a brake disc, a wire rope or hook). Fix the sheet where it fails.
3. Freeze v1. Record the version in this file.
4. Batch the catalogue per category as products get real SKUs (SKUs come from the client during the content phase).
5. One 20–30 s video per top category after its images are done.
