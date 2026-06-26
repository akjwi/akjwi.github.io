// "AI-like" rule-based SEO insights engine.
// Produces prioritized, human-readable recommendations.

function generateInsights(pages, scores) {
  const insights = [];
  const b = scores.breakdown;
  const total = b.totalPages || 1;

  const pct = (n) => Math.round((n / total) * 100);

  if (b.brokenLinks > 0) {
    insights.push({
      priority: 'critical',
      icon: '🔴',
      title: `${b.brokenLinks} broken page(s) detected`,
      detail: `Broken links (4xx/5xx) hurt crawlability and user trust. Fix or remove these URLs, or set up proper 301 redirects.`,
      affected: pages.filter(p => ['Broken', 'Server Error'].includes(p.statusLabel) || p.status === 0).map(p => p.url).slice(0, 10)
    });
  }

  if (b.missingTitle > 0) {
    insights.push({
      priority: 'high',
      icon: '🏷️',
      title: `${b.missingTitle} page(s) missing title tags (${pct(b.missingTitle)}%)`,
      detail: `Titles are the strongest on-page ranking signal. Add unique, descriptive titles (50–60 chars) to every page.`,
      affected: pages.filter(p => (p.issues || []).some(i => i.type === 'missing_title')).map(p => p.url).slice(0, 10)
    });
  }

  if (b.missingMeta > 0) {
    insights.push({
      priority: 'high',
      icon: '📝',
      title: `${b.missingMeta} page(s) missing meta descriptions`,
      detail: `Meta descriptions drive click-through from search results. Write compelling 120–155 char summaries with target keywords.`,
      affected: pages.filter(p => (p.issues || []).some(i => i.type === 'missing_meta')).map(p => p.url).slice(0, 10)
    });
  }

  if (b.missingH1 > 0) {
    insights.push({
      priority: 'high',
      icon: '🔖',
      title: `${b.missingH1} page(s) missing H1 headings`,
      detail: `Each page should have exactly one H1 that summarizes its content for both users and search engines.`,
      affected: pages.filter(p => (p.issues || []).some(i => i.type === 'missing_h1')).map(p => p.url).slice(0, 10)
    });
  }

  if (b.orphans > 0) {
    insights.push({
      priority: 'medium',
      icon: '🧭',
      title: `${b.orphans} orphan page(s) found`,
      detail: `Orphan pages have no internal links pointing to them, making them hard to discover. Add contextual internal links from related pages.`,
      affected: pages.filter(p => p.isOrphan).map(p => p.url).slice(0, 10)
    });
  }

  const redirectChainPages = pages.filter(p => (p.redirectChain || []).length > 2);
  if (redirectChainPages.length > 0) {
    insights.push({
      priority: 'medium',
      icon: '↪️',
      title: `${redirectChainPages.length} redirect chain(s) detected`,
      detail: `Multi-hop redirects waste crawl budget and slow load times. Point links directly to the final destination URL.`,
      affected: redirectChainPages.map(p => p.url).slice(0, 10)
    });
  }

  if (b.thinContent > 0) {
    insights.push({
      priority: 'medium',
      icon: '📄',
      title: `${b.thinContent} page(s) with thin content (<300 words)`,
      detail: `Thin pages rarely rank well. Expand with useful, original content or consolidate into stronger pages.`,
      affected: pages.filter(p => (p.issues || []).some(i => i.type === 'thin_content')).map(p => p.url).slice(0, 10)
    });
  }

  if (b.missingAlt > 0) {
    insights.push({
      priority: 'low',
      icon: '🖼️',
      title: `${b.missingAlt} page(s) have images missing alt text`,
      detail: `Alt text improves accessibility and image-search visibility. Describe each meaningful image concisely.`,
      affected: pages.filter(p => (p.issues || []).some(i => i.type === 'missing_alt')).map(p => p.url).slice(0, 10)
    });
  }

  if (b.slowPages > 0) {
    insights.push({
      priority: 'medium',
      icon: '⚡',
      title: `${b.slowPages} slow page(s) (>1000ms response)`,
      detail: `Slow server responses (avg ${b.avgResponse}ms) hurt rankings and UX. Investigate caching, CDN, and server optimization.`,
      affected: pages.filter(p => (p.responseTime || 0) > 1000).map(p => p.url).slice(0, 10)
    });
  }

  if (insights.length === 0) {
    insights.push({
      priority: 'good',
      icon: '✅',
      title: 'No major issues detected',
      detail: 'Your site is in good shape. Keep monitoring content freshness, internal linking, and performance.',
      affected: []
    });
  }

  // Sort by priority weight
  const weight = { critical: 0, high: 1, medium: 2, low: 3, good: 4 };
  insights.sort((a, b) => weight[a.priority] - weight[b.priority]);

  return insights;
}

module.exports = { generateInsights };
