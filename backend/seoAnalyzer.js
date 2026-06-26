// Analyzes a Cheerio-loaded page and extracts SEO data + issues.

function analyzePage($, url) {
  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
  const robots = ($('meta[name="robots"]').attr('content') || '').trim();
  const viewport = ($('meta[name="viewport"]').attr('content') || '').trim();
  const lang = ($('html').attr('lang') || '').trim();

  const h1s = [];
  $('h1').each((_, el) => h1s.push($(el).text().trim()));
  const h2s = [];
  $('h2').each((_, el) => h2s.push($(el).text().trim()));
  const h3s = [];
  $('h3').each((_, el) => h3s.push($(el).text().trim()));

  // Word count (visible text body, strip script/style)
  $('script, style, noscript').remove();
  const bodyText = ($('body').text() || '').replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

  // Images & alt analysis
  const images = [];
  let imagesMissingAlt = 0;
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    const hasAlt = alt !== undefined && alt.trim() !== '';
    if (!hasAlt) imagesMissingAlt++;
    images.push({ src, alt: alt || '', hasAlt });
  });

  // Open Graph
  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
  const ogImage = ($('meta[property="og:image"]').attr('content') || '').trim();

  // ---------- Issue detection ----------
  const issues = [];

  if (!title) issues.push({ type: 'missing_title', severity: 'high', msg: 'Missing <title> tag' });
  else if (title.length < 10) issues.push({ type: 'short_title', severity: 'medium', msg: `Title too short (${title.length} chars)` });
  else if (title.length > 65) issues.push({ type: 'long_title', severity: 'low', msg: `Title too long (${title.length} chars)` });

  if (!metaDescription) issues.push({ type: 'missing_meta', severity: 'high', msg: 'Missing meta description' });
  else if (metaDescription.length > 160) issues.push({ type: 'long_meta', severity: 'low', msg: `Meta description too long (${metaDescription.length} chars)` });
  else if (metaDescription.length < 50) issues.push({ type: 'short_meta', severity: 'low', msg: `Meta description too short (${metaDescription.length} chars)` });

  if (h1s.length === 0) issues.push({ type: 'missing_h1', severity: 'high', msg: 'Missing H1 heading' });
  else if (h1s.length > 1) issues.push({ type: 'multiple_h1', severity: 'medium', msg: `Multiple H1 tags (${h1s.length})` });

  if (wordCount > 0 && wordCount < 300) issues.push({ type: 'thin_content', severity: 'medium', msg: `Thin content (${wordCount} words)` });

  if (imagesMissingAlt > 0) issues.push({ type: 'missing_alt', severity: 'medium', msg: `${imagesMissingAlt} image(s) missing alt text` });

  if (!canonical) issues.push({ type: 'missing_canonical', severity: 'low', msg: 'Missing canonical URL' });

  if (!viewport) issues.push({ type: 'missing_viewport', severity: 'low', msg: 'Missing viewport meta (mobile)' });

  if (robots.toLowerCase().includes('noindex')) issues.push({ type: 'noindex', severity: 'high', msg: 'Page set to noindex' });

  return {
    title,
    titleLength: title.length,
    metaDescription,
    metaLength: metaDescription.length,
    canonical,
    robots,
    viewport,
    lang,
    h1: h1s,
    h2: h2s,
    h3: h3s,
    h1Count: h1s.length,
    wordCount,
    images,
    imageCount: images.length,
    imagesMissingAlt,
    ogTitle,
    ogImage,
    hasTitle: !!title,
    hasMeta: !!metaDescription,
    hasH1: h1s.length > 0,
    issues
  };
}

// Cross-page duplicate detection (call after full crawl)
function detectDuplicates(pages) {
  const titleMap = {};
  const metaMap = {};

  pages.forEach(p => {
    if (p.title) (titleMap[p.title] = titleMap[p.title] || []).push(p.url);
    if (p.metaDescription) (metaMap[p.metaDescription] = metaMap[p.metaDescription] || []).push(p.url);
  });

  pages.forEach(p => {
    p.issues = p.issues || [];
    if (p.title && titleMap[p.title].length > 1) {
      p.issues.push({ type: 'duplicate_title', severity: 'medium', msg: `Duplicate title (${titleMap[p.title].length} pages)` });
    }
    if (p.metaDescription && metaMap[p.metaDescription].length > 1) {
      p.issues.push({ type: 'duplicate_meta', severity: 'low', msg: `Duplicate meta description (${metaMap[p.metaDescription].length} pages)` });
    }
  });

  return pages;
}

module.exports = { analyzePage, detectDuplicates };
