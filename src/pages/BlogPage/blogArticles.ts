/* =============================================================
 * Skincare blog content.
 *
 * Condensed, rewritten editions of the guides on Shiseido's skincare
 * blog. They cover the same advice and the same products, but in
 * shorter form so they read well inside the storefront. Product
 * names must match catalog titles exactly: the article page looks
 * them up to render "Shop the routine" cards.
 *
 * `asks` are advisor prompts, written as the shopper would say them
 * because they land in the chat as the shopper's own message.
 * ============================================================= */

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "list"; items: { term?: string; text: string }[] }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "tip"; text: string };

export type BlogAsk = { label: string; prompt: string };

export type BlogArticle = {
  slug: string;
  title: string;
  /** One-sentence summary for cards and the article intro. */
  dek: string;
  topic: "Routines" | "Sun care" | "Skin concerns" | "Men";
  readMinutes: number;
  /** Catalog title whose image fronts the article. */
  heroProduct: string;
  /** Lifestyle photo in public/blog/<slug>.jpg. */
  photoAlt: string;
  /** CSS object-position for the photo crop. */
  photoPosition: string;
  body: BlogBlock[];
  /** Catalog titles for the "Shop the routine" row. */
  shop: string[];
  asks: BlogAsk[];
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "japanese-skincare-routine",
    title: "J-Beauty: how a Japanese skincare routine works",
    dek: "Six steps, layered lightest to richest, that soften, strengthen and protect skin, without a shelf full of products.",
    topic: "Routines",
    readMinutes: 4,
    heroProduct: "Ultimune Power Infusing Serum",
    photoAlt: "Woman in a robe misting her face at the bathroom mirror",
    photoPosition: "50% 40%",
    body: [
      { kind: "p", text: "Long before anyone called it J-Beauty, Japanese skincare leaned on ingredients like camellia oil, green tea and reishi mushroom. Modern Japanese skincare pairs those traditions with clinical science. The goal is skin that is genuinely healthy, not airbrushed: hydrated, clear, even and protected." },
      { kind: "p", text: "What sets it apart is the ritual. A Japanese routine is five or six deliberate steps focused on softening and hydrating, and each one preps skin for the next." },
      { kind: "h2", text: "The six steps" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse", text: "Wash away makeup, dirt and oil without stripping moisture. If you wear waterproof or long-wear makeup, dissolve it first with a makeup remover, then follow with a foam." },
          { title: "Soften", text: "The step unique to J-Beauty. A water-light softener hydrates and preps skin to absorb what follows. Saturate a cotton pad with three pumps and sweep it over the face." },
          { title: "Strengthen", text: "A strengthening serum helps skin defend itself against daily stressors and boosts everything after it. It always comes after softening and before any other serum." },
          { title: "Treat", text: "Target one concern at a time, such as fine lines, dark spots or lost firmness, with a dedicated serum. Layer more than one if you have several goals." },
          { title: "Moisturize", text: "Seal everything in with a cream. Moisturizer comes near the end because textures go on from the lightest to the heaviest." },
          { title: "Protect", text: "In the morning, finish with a broad-spectrum sunscreen. UV is the biggest outside driver of visible aging." },
        ],
      },
      { kind: "tip", text: "Layer from thinnest to thickest. A watery softener can't reach skin through a rich cream, so order matters more than the number of products." },
    ],
    shop: [
      "Clarifying Cleansing Foam",
      "Treatment Softener",
      "Ultimune Power Infusing Serum",
      "Intensive Firming Brilliance Serum",
      "Hydrating Cream",
      "Sun Protector Cream SPF 50",
    ],
    asks: [
      { label: "Build my routine", prompt: "Help me build a Japanese skincare routine for my skin, morning and night." },
      { label: "Which softener is mine?", prompt: "Which softener is right for my skin type? Help me choose." },
      { label: "Keep it to three steps", prompt: "I only have time for three steps. Help me build a short routine that still works." },
    ],
  },
  {
    slug: "mineral-vs-chemical-sunscreen",
    title: "Mineral vs. chemical sunscreen: which one is right for you?",
    dek: "Both block UV. One absorbs it and one reflects it, and that changes how each one feels, wears and suits your skin.",
    topic: "Sun care",
    readMinutes: 4,
    heroProduct: "Mineral Clear Sunscreen SPF 50",
    photoAlt: "Shiseido Urban Environment sunscreen among soft bubbles",
    photoPosition: "50% 50%",
    body: [
      { kind: "p", text: "Sunscreen isn't only for beach days. UV rays are present all year and pass through car and office windows, and they cause early wrinkles, dark spots and uneven tone. Everyone needs daily SPF, whatever their skin tone." },
      { kind: "p", text: "Most sunscreens fall into one of two families. Both protect well; they just work differently." },
      { kind: "h2", text: "How each one works" },
      {
        kind: "list",
        items: [
          { term: "Chemical sunscreen", text: "UV filters absorb the rays like a sponge, turn them into heat and release it. The texture is thin and sheer, and it disappears into skin." },
          { term: "Mineral sunscreen", text: "Zinc oxide or titanium dioxide particles sit on top of skin and reflect UVA and UVB away. Check the active ingredients: those two minerals are the giveaway." },
        ],
      },
      { kind: "h2", text: "Why choose mineral" },
      {
        kind: "list",
        items: [
          { text: "It protects as soon as it's on. Chemical formulas need 20 to 30 minutes to settle in." },
          { text: "It can go over makeup and skincare because it sits on the surface." },
          { text: "It is usually the gentler pick for sensitive or blemish-prone skin, and for kids." },
        ],
      },
      { kind: "h2", text: "Why choose chemical" },
      {
        kind: "list",
        items: [
          { text: "It's invisible, so it's easy to wear every day and works well on deeper skin tones with no white cast." },
          { text: "It usually lasts longer between reapplications, even when swimming." },
        ],
      },
      { kind: "tip", text: "Water resistance is time-limited, typically 40 or 80 minutes. Check the label, and reapply after swimming, sweating or toweling off." },
      { kind: "p", text: "Shiseido's SynchroShield technology adds another layer: the protective veil gets stronger with water and sweat (WetForce) and with heat (HeatForce), so it holds up on the days you need it most." },
    ],
    shop: [
      "Mineral Clear Sunscreen SPF 50",
      "Sun Protector Cream SPF 50",
      "Fresh-Moisture Sunscreen SPF 40",
      "Urban Environment Oil-Control Sunscreen SPF 40",
    ],
    asks: [
      { label: "Mineral or chemical for me?", prompt: "Should I use a mineral or a chemical sunscreen? Help me pick one for my skin." },
      { label: "For sensitive skin", prompt: "My skin is sensitive. Help me find a gentle sunscreen." },
      { label: "Holds up to sweat", prompt: "Help me find a sunscreen that holds up to sweat and water for workouts and beach days." },
    ],
  },
  {
    slug: "moisturizer-guide",
    title: "How to choose a moisturizer for your skin type",
    dek: "What moisturizer does, why oily skin needs it too, and which texture suits normal, dry, oily and combination skin.",
    topic: "Routines",
    readMinutes: 4,
    heroProduct: "Hydrating Cream",
    photoAlt: "Woman with glowing skin balancing a jar of Essential Energy moisturizer",
    photoPosition: "40% 40%",
    body: [
      { kind: "p", text: "A moisturizer blends oil, water and nourishing ingredients into a protective layer. It restores lost moisture and locks it in so heat, cold and dry air can't pull it back out." },
      { kind: "h2", text: "What it does for you" },
      {
        kind: "list",
        items: [
          { term: "Balances oil", text: "Skin that's too dry makes more oil to compensate. Keeping it hydrated keeps oil in check." },
          { term: "Soothes sensitivity", text: "Dry, itchy, red patches are a sign skin needs extra care. Look for soothing botanicals." },
          { term: "Keeps skin plump", text: "Well-hydrated skin looks firmer and smoother, and starting early helps slow visible aging." },
          { term: "Protects by day", text: "A day cream with SPF moisturizes and guards against UV in one step." },
        ],
      },
      { kind: "h2", text: "Match it to your skin type" },
      {
        kind: "list",
        items: [
          { term: "Normal", text: "Balanced and clear. A lighter cream is plenty." },
          { term: "Dry", text: "Flaky, tight or rough. Reach for a richer cream." },
          { term: "Oily", text: "Shiny by midday. Pick a light, non-greasy texture." },
          { term: "Combination", text: "Oily T-zone, dry cheeks. A lightweight cream works for both." },
        ],
      },
      { kind: "h2", text: "When to use it" },
      {
        kind: "steps",
        items: [
          { title: "Morning", text: "After serum and before sunscreen and makeup. A day cream with SPF saves a step." },
          { title: "Night", text: "Skin repairs itself while you sleep, so give it a richer night cream." },
          { title: "Flights", text: "Cabin air is very dry. Apply before takeoff and after landing." },
          { title: "Breakouts", text: "Don't skip it. Dried-out skin builds up dead cells and can make breakouts worse." },
        ],
      },
    ],
    shop: [
      "Hydrating Cream",
      "Wrinkle Smoothing Cream",
      "Wrinkle Smoothing Day Cream SPF 23",
      "Overnight Wrinkle Resisting Cream",
      "Total Regenerating Cream",
      "Uplifting and Firming Advanced Day Cream SPF 30",
    ],
    asks: [
      { label: "Right for my skin type", prompt: "Help me find the right moisturizer for my skin type." },
      { label: "Day cream with SPF", prompt: "Help me pick a day cream with SPF so I can moisturize and protect in one step." },
      { label: "Night cream that repairs", prompt: "Help me pick a night cream that hydrates and smooths while I sleep." },
    ],
  },
  {
    slug: "how-to-tighten-skin",
    title: "How to tighten skin: a lifting and firming routine",
    dek: "Why skin loses its bounce, the three ingredient families that help, and a face, eye and neck routine to lift.",
    topic: "Skin concerns",
    readMinutes: 5,
    heroProduct: "LiftDefine Radiance Face Mask",
    photoAlt: "Smiling older woman with silver hair",
    photoPosition: "50% 30%",
    body: [
      { kind: "p", text: "Skin sags when collagen and elastin, the proteins that make skin bounce back, break down faster than the body replaces them. Production slows with age, and UV, pollution, hormonal shifts and weight changes speed up the loss. Skin also gets drier and thinner, so lines show first around the eyes, mouth, jaw and neck." },
      { kind: "h2", text: "Ingredients that actually firm" },
      {
        kind: "list",
        items: [
          { term: "Retinoids", text: "Vitamin A derivatives, like retinol, speed up cell turnover and boost collagen and elastin." },
          { term: "Antioxidants", text: "Shield skin from free radicals, UV and pollution, which keep breaking down firmness." },
          { term: "Peptides", text: "Amino-acid chains that skin uses to build collagen, so skin looks plumper and tighter." },
        ],
      },
      { kind: "h2", text: "Four habits that keep skin firm" },
      {
        kind: "list",
        items: [
          { text: "Defend against free radicals with antioxidant-rich products." },
          { text: "Wear sunscreen daily, because UV is a major cause of sagging." },
          { text: "Lock in moisture, especially after retinol, and drink plenty of water." },
          { text: "Be consistent: a morning and evening routine beats occasional treatments." },
        ],
      },
      { kind: "h2", text: "The lifting routine" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse", text: "Use a rich, moisture-retaining foam and gentle circles over face and neck." },
          { title: "Mask", text: "A two-piece lifting mask tones the cheeks and defines the jaw in 10 minutes. Massage in the leftover essence." },
          { title: "Eyes", text: "An express eye mask for 10 minutes, then a firming eye cream." },
          { title: "Serum", text: "A sculpting serum rich in antioxidants and peptides, on face and neck." },
          { title: "Cream", text: "Finish with a lifting and firming cream, with SPF in the morning." },
        ],
      },
      { kind: "tip", text: "Never tug at loose skin. Apply products with upward, gentle strokes, and treat the neck as part of the face." },
    ],
    shop: [
      "Extra Rich Cleansing Foam",
      "LiftDefine Radiance Face Mask",
      "Uplifting and Firming Express Eye Mask",
      "Uplifting and Firming Advanced Eye Cream",
      "Intensive SculptDefine Serum",
      "Uplifting & Firming Advanced Cream",
    ],
    asks: [
      { label: "Lift and firm my face", prompt: "My skin is losing firmness. Help me build a routine that lifts and firms." },
      { label: "Firm the eye area", prompt: "Help me firm and lift the skin around my eyes." },
      { label: "Where do I start?", prompt: "If I only buy one firming product, which should it be?" },
    ],
  },
  {
    slug: "anti-aging-skincare",
    title: "Anti-aging skincare: how to keep skin looking young",
    dek: "Four ingredients worth knowing and a five-step ritual to smooth lines, restore radiance and protect what you have.",
    topic: "Skin concerns",
    readMinutes: 4,
    heroProduct: "Total Regenerating Cream",
    photoAlt: "Woman smoothing cream onto her cheek",
    photoPosition: "50% 35%",
    body: [
      { kind: "p", text: "Your skin really is different from five or ten years ago. Collagen and elastin fall over time, skin thins and loosens, and lines settle around the eyes and mouth. You can't stop time, but a good routine can visibly slow its effects." },
      { kind: "h2", text: "Ingredients to look for" },
      {
        kind: "list",
        items: [
          { term: "Retinoids", text: "The most studied wrinkle fighters. They reduce wrinkle depth, improve firmness and help prevent sunspots." },
          { term: "Antioxidants", text: "Protect against oxidation from UV and pollution that adds new signs of aging." },
          { term: "Peptides", text: "Building blocks for collagen and elastin that help skin look tighter." },
          { term: "Hyaluronic acid", text: "A big drink of water for skin: it holds moisture so skin looks plump, not dull." },
        ],
      },
      { kind: "h2", text: "The five-step ritual" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse", text: "Use two pearl-sized drops of a creamy foam and lukewarm water, worked in gentle circles." },
          { title: "Soften", text: "Pat on a softener with a cotton pad so moisture doesn't escape after cleansing and the next steps absorb." },
          { title: "Serum", text: "One pump of a thin, concentrated serum. Choose firming if sagging is your main concern." },
          { title: "Moisturize", text: "A rich day cream by morning. At night, a regenerating cream plus an eye and lip cream." },
          { title: "Protect", text: "Every morning, finish with broad-spectrum SPF." },
        ],
      },
      { kind: "tip", text: "Thinnest to thickest, every time. That order is what lets each layer reach skin." },
    ],
    shop: [
      "Extra Rich Cleansing Foam",
      "Concentrated Brightening Softener",
      "Legendary Enmei Ultimate Luminance Serum",
      "Legendary Enmei Ultimate Renewing Cream",
      "Total Regenerating Cream",
      "Eye and Lip Contour Regenerating Cream",
    ],
    asks: [
      { label: "Anti-aging essentials", prompt: "Help me build an anti-aging routine with the essentials." },
      { label: "Smooth fine lines", prompt: "Help me find a serum to smooth fine lines and wrinkles." },
      { label: "Is retinol right for me?", prompt: "Should I use retinol? Help me find a retinol product that suits my skin." },
    ],
  },
  {
    slug: "how-to-care-for-oily-skin",
    title: "How to care for oily skin",
    dek: "What causes excess oil, what to use and avoid, and a five-step routine for less shine and clearer pores.",
    topic: "Skin concerns",
    readMinutes: 4,
    heroProduct: "Deep Cleansing Foam",
    photoAlt: "Smiling woman touching her fresh, matte skin",
    photoPosition: "35% 40%",
    body: [
      { kind: "p", text: "Oily skin happens when the glands in hair follicles make more sebum than skin needs. A little sebum is good: it moisturizes and protects. Too much means shine, enlarged pores, blackheads and breakouts. Genetics, hormones, climate and lifestyle all play a part." },
      { kind: "h2", text: "What helps, and what to skip" },
      {
        kind: "list",
        items: [
          { term: "Look for", text: "Hyaluronic acid for weightless moisture, niacinamide to soothe, ceramides to support the barrier, and retinol to refine texture." },
          { term: "Avoid", text: "Heavy oils and alcohol-heavy formulas. Choose labels that say oil-free and non-comedogenic." },
        ],
      },
      { kind: "h2", text: "Daily habits" },
      {
        kind: "list",
        items: [
          { text: "Cleanse morning, night and after every workout." },
          { text: "Never sleep in makeup; it settles into pores overnight." },
          { text: "Keep hands off your face except when applying products." },
        ],
      },
      { kind: "h2", text: "The oily-skin routine" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse", text: "A sebum-absorbing foam, or a wipe-off cleansing water on a cotton pad." },
          { title: "Soften", text: "A softener for normal to oily skin removes extra oil and refines texture." },
          { title: "Moisturize", text: "Don't skip it. A light, non-greasy cream stops skin from overcompensating." },
          { title: "Prime", text: "Before makeup, a mattifying primer on the T-zone blurs pores and controls shine." },
          { title: "Protect", text: "An oil-free sunscreen with a soft matte finish." },
        ],
      },
    ],
    shop: [
      "Deep Cleansing Foam",
      "Refreshing Cleansing Water",
      "Treatment Softener",
      "Hydrating Cream",
      "Urban Environment Oil-Control Sunscreen SPF 40",
    ],
    asks: [
      { label: "Routine for oily skin", prompt: "I have oily skin. Help me build a routine that controls shine." },
      { label: "Clear my pores", prompt: "Help me find products that clear and minimize my pores." },
      { label: "SPF that won't shine", prompt: "I have oily skin. Help me find a sunscreen that won't make me shiny." },
    ],
  },
  {
    slug: "why-is-my-skin-so-dry",
    title: "Why is my skin so dry? Causes and a routine that helps",
    dek: "From weather to hot showers, what dries skin out, and the gentle, hydrating routine that brings it back.",
    topic: "Skin concerns",
    readMinutes: 3,
    heroProduct: "Hydrating Cream",
    photoAlt: "Woman in a towel applying moisturizer at the mirror",
    photoPosition: "30% 40%",
    body: [
      { kind: "p", text: "Dry skin can show up in patches or across the whole face, and it looks rough and dull and feels tight or itchy. Common causes include cold or dry weather, sun, harsh soaps, long hot showers, hard water, irritants and genetics. The good news: it responds well to the right care." },
      { kind: "h2", text: "What dry skin needs" },
      { kind: "p", text: "Products that pull moisture in and hold it there. Hyaluronic acid attracts and retains water; botanicals like ginseng help strengthen the moisture barrier so hydration lasts. Skip harsh, stripping cleansers and heavy fragrance." },
      { kind: "h2", text: "The dry-skin routine" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse gently", text: "Pick a creamy or milky cleanser that removes makeup without that squeaky, tight feeling." },
          { title: "Soften", text: "An enriched softener for normal to dry skin plumps and preps." },
          { title: "Serum", text: "A hydrating, strengthening serum smooths flakiness and dullness." },
          { title: "Moisturize", text: "A cream with hyaluronic acid, generously applied morning and night." },
          { title: "Protect", text: "A moisturizing sunscreen by day, since sun dries skin further." },
          { title: "Mask weekly", text: "A hydrating or overnight mask as a once- or twice-a-week boost." },
        ],
      },
      { kind: "tip", text: "Keep showers warm, not hot, and apply your softener within a minute of drying off, while skin is still slightly damp." },
    ],
    shop: [
      "Extra Rich Cleansing Milk",
      "Treatment Softener Enriched",
      "Ultimune Power Infusing Serum",
      "Hydrating Cream",
      "Fresh-Moisture Sunscreen SPF 40",
      "YUZU-C Beauty Sleeping Mask",
    ],
    asks: [
      { label: "Routine for dry skin", prompt: "My skin is really dry. Help me build a hydrating routine." },
      { label: "Gentle cleanser", prompt: "My skin feels tight after washing. Help me find a gentle cleanser for dry skin." },
      { label: "Overnight hydration", prompt: "Help me find something that hydrates my skin overnight." },
    ],
  },
  {
    slug: "skin-care-for-men",
    title: "Skin care for men: a simple five-step routine",
    dek: "Men's skin is thicker and oilier, and shaving adds its own stress. Here's a routine built around that, in five steps.",
    topic: "Men",
    readMinutes: 4,
    heroProduct: "Face Cleanser",
    photoAlt: "Man with clear, hydrated skin",
    photoPosition: "40% 40%",
    body: [
      { kind: "p", text: "Men's grooming used to mean soap, shaving cream and aftershave. But men's skin is generally thicker and oilier, thanks to testosterone, and shaving makes the cheeks and neck more sensitive, so products made for it simply work better. You don't need a dozen of them; five steps cover it." },
      { kind: "h2", text: "Start with your skin type" },
      {
        kind: "list",
        items: [
          { term: "Sensitive", text: "Redness or stinging after products. Skip fragrance and harsh scrubs." },
          { term: "Oily", text: "Shiny without a workout. Go oil-free and water-based." },
          { term: "Acne-prone", text: "Breakouts or ingrown hairs where you shave. Choose non-comedogenic." },
          { term: "Dry", text: "Flaky or rough even after moisturizing. Look for hyaluronic acid." },
          { term: "Combination", text: "Oily forehead, dry elsewhere. Choose lightweight moisture." },
        ],
      },
      { kind: "h2", text: "The routine" },
      {
        kind: "steps",
        items: [
          { title: "Cleanse", text: "A dime-sized amount of foaming cleanser, lathered and rinsed with lukewarm water." },
          { title: "Shave smarter", text: "The same cleanser doubles as a moisturizing shave cream. After shaving, a hydrating lotion soothes; oily skin can use it alone as an aftershave." },
          { title: "Repair", text: "Two pumps of a strengthening serum, morning and night, to undo daily stress from sun and pollution." },
          { title: "Moisturize", text: "A light, non-greasy moisturizer, plus an eye cream for the under-eye area." },
          { title: "Protect", text: "Oil-free sunscreen for oily skin, a moisturizing one for dry skin, and a stick for the body." },
        ],
      },
    ],
    shop: [
      "Face Cleanser",
      "Hydrating Lotion",
      "Shiseido Men Ultimune Power Infusing Serum",
      "Energizing Moisturizer Extra Light Fluid",
      "Total Revitalizer Eye Cream",
      "Men’s Basics Bundle ($86 Value)",
    ],
    asks: [
      { label: "A simple routine for him", prompt: "Help me build a simple skincare routine for a man." },
      { label: "Stop razor burn", prompt: "I get razor burn when I shave. Help me find products that soothe it." },
      { label: "A gift for him", prompt: "Help me pick a skincare set for a man." },
    ],
  },
];

export function getBlogArticle(slug: string | null | undefined): BlogArticle | undefined {
  if (!slug) return undefined;
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function blogPhotoUrl(slug: string) {
  return `${import.meta.env.BASE_URL}blog/${slug}.jpg`;
}
