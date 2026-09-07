import { buildTree, emit, plain } from './generate-taxonomy.mjs';
import { writeFileSync } from 'node:fs';

let pass=0,fail=0;
const ok=(n,c,extra='')=>{ c?pass++:fail++; console.log((c?'✅':'❌')+' '+n+(c?'':'  '+extra)); };

const T=(slug,name,parent,id,meta,desc)=>({slug,name,description:desc??'',count:0,databaseId:id,
  parent:parent?{node:{slug:parent}}:null, categoryMeta:meta??null});

// ── 1. happy path ─────────────────────────────────────────────
let r=buildTree([
  T('hoist-accessories','بالابر و متعلقات',null,10,{keyword:'بالابر جرثقیل',iconPath:'M1 2'},'<p>متن سیلو</p>'),
  T('crane-coupling','کوپلینگ جرثقیل سقفی','hoist-accessories',20,{keyword:'کوپلینگ جرثقیل سقفی',aka:'کوبلینگ\nکوپلینک',iconPath:'M3 4'},'توضیح'),
  T('rope-guide','کمربند جرثقیل سقفی','hoist-accessories',21,null,''),
  T('brake','ترمز و متعلقات',null,11,null,''),
  T('rectifier','رکتیفایر','brake',30,null,''),
]);
ok('no errors', r.errors.length===0, JSON.stringify(r.errors));
ok('2 silos', r.silos.length===2);
ok('silo order = databaseId', r.silos[0].slug==='hoist-accessories'&&r.silos[1].slug==='brake');
ok('children attached', r.silos[0].categories.length===2 && r.silos[1].categories.length===1);
ok('aka split on newline', JSON.stringify(r.silos[0].categories[0].aka)===JSON.stringify(['کوبلینگ','کوپلینک']));
ok('aka empty when absent', r.silos[0].categories[1].aka.length===0);
ok('html stripped from description', r.silos[0].intro==='متن سیلو', r.silos[0].intro);
ok('keyword falls back to name', r.silos[1].keyword==='ترمز و متعلقات', r.silos[1].keyword);
ok('keyword from ACF wins', r.silos[0].keyword==='بالابر جرثقیل');

// ── 2. NEW category added in WP only ──────────────────────────
r=buildTree([
  T('hoist-accessories','بالابر',null,10),
  T('crane-coupling','کوپلینگ','hoist-accessories',20),
  T('brand-new-part','قطعه‌ی کاملاً جدید','hoist-accessories',99),
]);
ok('brand-new WP category appears', r.silos[0].categories.some(c=>c.slug==='brand-new-part'), JSON.stringify(r.errors));
ok('new category last (id order)', r.silos[0].categories[1].slug==='brand-new-part');

// ── 3. NEW silo added in WP only ──────────────────────────────
r=buildTree([T('hoist-accessories','بالابر',null,10),T('x','ی','hoist-accessories',11),
             T('eighth-silo','سیلوی هشتم',null,500),T('y','ی۲','eighth-silo',501)]);
ok('8th silo recognised with no code change', r.silos.length===2 && r.silos[1].slug==='eighth-silo');

// ── 4. depth-3 rejected ───────────────────────────────────────
r=buildTree([T('a','A',null,1),T('b','B','a',2),T('c','C','b',3)]);
ok('depth-3 is an error', r.errors.length===1 && /سطح سوم/.test(r.errors[0]), JSON.stringify(r.errors));
ok('depth-3 excluded from output', !JSON.stringify(r.silos).includes('"c"'));

// ── 5. non-latin slug rejected ────────────────────────────────
r=buildTree([T('a','A',null,1),T('%DA%A9%D9%88','کوپلینگ','a',2)]);
ok('percent-encoded slug is an error', r.errors.length===1 && /لاتین نیست/.test(r.errors[0]));

// ── 6. empty silo warns but does not fail ─────────────────────
r=buildTree([T('a','A',null,1),T('lonely','تنها',null,2)]);
ok('empty silo warns', r.warnings.some(w=>/هیچ دسته/.test(w)));
ok('empty silo not an error', r.errors.length===0);

// ── 7. missing parent ─────────────────────────────────────────
r=buildTree([T('orphan','یتیم','ghost-parent',5)]);
ok('missing parent is an error', r.errors.length===1 && /پیدا نشد/.test(r.errors[0]));

// ── 8. emit produces parseable TS + round-trips ───────────────
r=buildTree([
  T('hoist-accessories','بالابر و متعلقات',null,10,{keyword:'k',aka:'م۱\nم۲',iconPath:'M1 2'},'intro'),
  T("quote-test","نامی با ' آپاستروف",'hoist-accessories',20,{iconPath:'M1 2\\3'},"بلرب با ' و \\ داخلش"),
]);
const out=emit(r.silos);
writeFileSync('/tmp/gen.mjs', out.replace(/^\/\/.*$/gm,'').replace('export const SILOS_DATA','export const SILOS_DATA'));
const m=await import('/tmp/gen.mjs?v='+Date.now());
ok('emitted TS parses as JS', Array.isArray(m.SILOS_DATA));
ok('round-trip: apostrophe survived', m.SILOS_DATA[0].categories[0].name==="نامی با ' آپاستروف", m.SILOS_DATA[0].categories[0].name);
ok('round-trip: backslash survived', m.SILOS_DATA[0].categories[0].icon==='M1 2\\3', m.SILOS_DATA[0].categories[0].icon);
ok('round-trip: aka survived', JSON.stringify(m.SILOS_DATA[0].aka??[])==='[]');
ok('URL comment block emitted', /\/\/   \/categories\/hoist-accessories\/quote-test/.test(out));
ok('URL count correct', (out.match(/^\/\/   \/categories\//gm)||[]).length===2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
