// src/lib/related-guides.ts
// ---------------------------------------------------------------------------
// «راهنماهای مرتبط» روی صفحه‌ی محصول — عکسِ «محصولات مرتبط به این مقاله».
//
// ⚠️ چرا (۲۹ آبان ۱۴۰۵): ایده‌ی دیجی‌کالا که پذیرفتیم «فروشگاه برای خرید، مجله برای یادگیری، با لینک بین دو» بود؛
// تا امروز فقط یک‌طرفه ساخته شده بود (مقاله → محصول). خریداری که روی صفحه‌ی فرستنده است و نمی‌داند جفتش کند، به
// راهنمای جفت کردن نمی‌رسید. حالا همان امتیازدهی relatedProductsForPost (یک منطق، یک آزمون) برعکس خوانده می‌شود:
// هر مقاله‌ای که این محصول را «مرتبط» می‌بیند، روی صفحه‌ی محصول راهنمای مرتبط است. هیچ فهرست دستی.
// واکشی همه‌ی مقاله‌ها و بلوک‌هایشان یک بار در هر build (memo) — نه به ازای هر صفحه‌ی محصول.
// ---------------------------------------------------------------------------
import { getPosts } from './posts';
import { getBlocks } from './content-blocks';
import { getAllProducts } from './wp';
import { ALL_CATEGORIES } from '../data/taxonomy';
import { relatedProductsForPost } from '../components/related-products';

export interface GuideLink {
  title: string;
  href: string;
}

let memo: Promise<Map<string, GuideLink[]>> | null = null;

async function build(): Promise<Map<string, GuideLink[]>> {
  const [posts, products] = await Promise.all([getPosts(), getAllProducts()]);
  const map = new Map<string, GuideLink[]>();
  for (const post of posts) {
    const blocks = await getBlocks('post', post.slug);
    const text = blocks.map((b) => [b.bodyHtml, ...b.faqs.map((f) => `${f.question} ${f.answer}`)].join(' ')).join(' ');
    for (const p of relatedProductsForPost({ title: post.title, bodyHtml: `${post.bodyHtml} ${text}` }, products, ALL_CATEGORIES, 20)) {
      const list = map.get(p.slug) ?? [];
      list.push({ title: post.title, href: `/blog/${post.slug}/` });
      map.set(p.slug, list);
    }
  }
  return map;
}

/** راهنماهای مرتبط با یک محصول (حداکثر limit)؛ مقاله‌ای که مستقیم به محصول پیوند داده جلوتر است. */
export async function relatedGuidesForProduct(slug: string, limit = 4): Promise<GuideLink[]> {
  memo ??= build();
  return ((await memo).get(slug) ?? []).slice(0, limit);
}
