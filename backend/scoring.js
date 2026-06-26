// Computes SEO, Performance, and Site Health scores (0-100).

function computeScores(pages) {
  if (!pages || pages.length === 0) {
    return { seo: 0, performance: 0, health: 0, breakdown: {} };
  }

  const total = pages.length;

  // ---- Issue counters ----
  let brokenLinks = 0;
  let redirects = 0;
  let missingTitle = 0;
  let missingMeta = 0;
  let missingH1 = 0;
  let thinContent = 0;
  let missingAlt = 0;
  let orphans = 0;
  let noindex = 0;

  let totalResponse = 0;
  let slowPages = 0;
  let okPages = 0;

  pages.forEach(p => {
    const issues = p.issues || [];
    if (p.statusLabel === 'Broken' || p.statusLabel === 'Server Error' || p.status === 0) brokenLinks++;
    if (p.statusLabel === 'Redirect') redirects++;
    if (p.statusLabel === 'OK') okPages++;

    if (issues.some(i => i.type === 'missing_title')) missingTitle++;
    if (issues.some(i => i.type === 'missing_meta')) missingMeta++;
    if (issues.some(i => i.type === 'missing_h1')) missingH1++;
    if (issues.some(i => i.type === 'thin_content')) thinContent++;
    if (issues.some(i => i.type === 'missing_alt')) missingAlt++;
    if (issues.some(i => i.type === 'noindex')) noindex++;
    if (p.isOrphan) orphans++;

    totalResponse += p.responseTime || 0;
    if ((p.responseTime || 0) > 1000) slowPages++;
  });

  const avgResponse = totalResponse / total;

  // ---- SEO Score ----
  // Start 100, subtract weighted penalties (as ratio of pages affected)
  let seo = 100;
  seo -= (missingTitle / total) * 25;
  seo -= (missingMeta / total) * 15;
  seo -= (missingH1 / total) * 15;
  seo -= (thinContent / total) * 10;
  seo -= (missingAlt / total) * 8;
  seo -= (noindex / total) * 12;
  seo -= (orphans / total) * 10;
  seo = clamp(seo);

  // ---- Performance Score ----
  // Reward fast avg response, penalize slow pages
  let performance = 100;
  if (avgResponse > 200) performance -= ((avgResponse - 200) / 30); // gradual penalty
  performance -= (slowPages / total) * 30;
  performance = clamp(performance);

  // ---- Site Health Score ----
  // Heavily penalize broken links
  let health = 100;
  health -= (brokenLinks / total) * 50;
  health -= (redirects / total) * 15;
  health -= (orphans / total) * 10;
  // weighted blend with seo + performance
  health = clamp(health * 0.6 + seo * 0.25 + performance * 0.15);

  return {
    seo: Math.round(seo),
    performance: Math.round(performance),
    health: Math.round(health),
    breakdown: {
      totalPages: total,
      okPages,
      brokenLinks,
      redirects,
      missingTitle,
      missingMeta,
      missingH1,
      thinContent,
      missingAlt,
      orphans,
      noindex,
      avgResponse: Math.round(avgResponse),
      slowPages
    }
  };
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

module.exports = { computeScores };
