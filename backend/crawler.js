const axios = require('axios');
const cheerio = require('cheerio');
const pLimit = require('p-limit');
const { URL } = require('url');

const { analyzePage } = require('./seoAnalyzer');

class Crawler {
  constructor(config, hooks = {}) {
    this.startUrl = this._normalizeStart(config.url);
    this.maxDepth = Math.min(Math.max(parseInt(config.depth) || 3, 1), 10);
    this.concurrency = Math.min(Math.max(parseInt(config.concurrency) || 5, 1), 20);
    this.maxPages = parseInt(config.maxPages) || 500;
    this.timeout = parseInt(config.timeout) || 15000;
    this.ignoreQuery = config.ignoreQuery !== false;
    this.userAgent = config.userAgent || 'SEOAuditPro/1.0 (+desktop-crawler)';

    this.origin = new URL(this.startUrl).origin;
    this.hooks = hooks;

    this.visited = new Set();   // normalized URLs already queued/processed
    this.results = [];          // page result objects
    this.queue = [];            // { url, depth }
    this.stopped = false;

    // link graph for orphan detection
    this.inboundCount = new Map(); // url -> inbound internal link count
  }

  _normalizeStart(raw) {
    let u = (raw || '').trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u;
  }

  // Normalize URL: strip hash, optionally strip query, trailing slash
  normalize(href, base) {
    try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      u.hash = '';
      if (this.ignoreQuery) u.search = '';
      let s = u.toString();
      // Remove trailing slash (except root)
      if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
      return s;
    } catch {
      return null;
    }
  }

  isSameDomain(url) {
    try {
      return new URL(url).origin === this.origin;
    } catch {
      return false;
    }
  }

  log(msg) {
    if (this.hooks.onLog) this.hooks.onLog(msg);
  }

  stop() {
    this.stopped = true;
  }

  async fetch(url) {
    const start = Date.now();
    const redirectChain = [];

    try {
      const res = await axios.get(url, {
        timeout: this.timeout,
        maxRedirects: 0, // we track redirects manually
        validateStatus: () => true,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        responseType: 'text'
      });

      const responseTime = Date.now() - start;

      // Manual redirect following (chain tracking)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        let location = res.headers.location;
        let current = url;
        let status = res.status;
        let hops = 0;
        redirectChain.push({ url: current, status });

        while (location && hops < 10) {
          const next = this.normalize(location, current) || location;
          redirectChain.push({ url: next, status });
          const r2 = await axios.get(next, {
            timeout: this.timeout,
            maxRedirects: 0,
            validateStatus: () => true,
            headers: { 'User-Agent': this.userAgent },
            responseType: 'text'
          });
          status = r2.status;
          if ([301, 302, 303, 307, 308].includes(status)) {
            location = r2.headers.location;
            current = next;
            hops++;
          } else {
            return {
              status,
              finalUrl: next,
              html: typeof r2.data === 'string' ? r2.data : '',
              responseTime: Date.now() - start,
              redirectChain,
              contentType: r2.headers['content-type'] || ''
            };
          }
        }
      }

      return {
        status: res.status,
        finalUrl: url,
        html: typeof res.data === 'string' ? res.data : '',
        responseTime,
        redirectChain,
        contentType: res.headers['content-type'] || ''
      };
    } catch (err) {
      return {
        status: 0,
        finalUrl: url,
        html: '',
        responseTime: Date.now() - start,
        redirectChain,
        error: err.code || err.message,
        contentType: ''
      };
    }
  }

  // Quick HEAD-like check for external links / images (status only)
  async checkStatus(url) {
    const start = Date.now();
    try {
      const res = await axios.head(url, {
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': this.userAgent }
      });
      return { status: res.status, responseTime: Date.now() - start };
    } catch {
      // some servers reject HEAD; fallback to GET
      try {
        const res = await axios.get(url, {
          timeout: this.timeout,
          maxRedirects: 5,
          validateStatus: () => true,
          headers: { 'User-Agent': this.userAgent },
          responseType: 'text'
        });
        return { status: res.status, responseTime: Date.now() - start };
      } catch (e) {
        return { status: 0, responseTime: Date.now() - start, error: e.code || e.message };
      }
    }
  }

  async run() {
    const limit = pLimit(this.concurrency);
    this.queue.push({ url: this.startUrl, depth: 0 });
    this.visited.add(this.startUrl);

    let processedCount = 0;

    // Process queue in waves (per depth-ish) using concurrency limit
    while (this.queue.length > 0 && !this.stopped) {
      if (this.results.length >= this.maxPages) {
        this.log(`Reached max pages limit (${this.maxPages})`);
        break;
      }

      const batch = this.queue.splice(0, this.queue.length);
      const tasks = batch.map(item => limit(async () => {
        if (this.stopped || this.results.length >= this.maxPages) return;

        const { url, depth } = item;
        this.log(`Crawling [d${depth}]: ${url}`);

        const fetched = await this.fetch(url);
        processedCount++;

        let analysis = {};
        const internalLinks = [];
        const externalLinks = [];

        if (fetched.html && fetched.contentType.includes('text/html')) {
          const $ = cheerio.load(fetched.html);
          analysis = analyzePage($, url);

          // Extract links
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const norm = this.normalize(href, fetched.finalUrl);
            if (!norm) return;
            if (this.isSameDomain(norm)) {
              internalLinks.push(norm);
              this.inboundCount.set(norm, (this.inboundCount.get(norm) || 0) + 1);
              // enqueue if new + within depth
              if (!this.visited.has(norm) && depth < this.maxDepth) {
                this.visited.add(norm);
                this.queue.push({ url: norm, depth: depth + 1 });
              }
            } else {
              externalLinks.push(norm);
            }
          });
        }

        const page = {
          url,
          finalUrl: fetched.finalUrl,
          status: fetched.status,
          statusLabel: this._statusLabel(fetched.status, fetched.redirectChain),
          responseTime: fetched.responseTime,
          depth,
          redirectChain: fetched.redirectChain,
          error: fetched.error || null,
          internalLinks: [...new Set(internalLinks)],
          externalLinks: [...new Set(externalLinks)],
          ...analysis
        };

        this.results.push(page);

        if (this.hooks.onPage) this.hooks.onPage(page);
        if (this.hooks.onProgress) {
          this.hooks.onProgress({
            processed: this.results.length,
            queued: this.queue.length,
            currentUrl: url,
            status: fetched.status
          });
        }
      }));

      await Promise.all(tasks);
    }

    // Post-process: orphan detection
    this._detectOrphans();

    // Validate external links (status only) — limited
    await this._validateExternalLinks(limit);

    return {
      startUrl: this.startUrl,
      origin: this.origin,
      crawledAt: new Date().toISOString(),
      pages: this.results,
      stopped: this.stopped
    };
  }

  _statusLabel(status, redirectChain) {
    if (status === 0) return 'Error';
    if (status >= 200 && status < 300) return 'OK';
    if (status >= 300 && status < 400) return 'Redirect';
    if (status >= 400 && status < 500) return 'Broken';
    if (status >= 500) return 'Server Error';
    return 'Unknown';
  }

  _detectOrphans() {
    for (const page of this.results) {
      const inbound = this.inboundCount.get(page.url) || 0;
      // start page is never orphan
      page.inboundLinks = inbound;
      page.isOrphan = (page.url !== this.startUrl && inbound === 0);
    }
  }

  async _validateExternalLinks(limit) {
    // Collect unique external links across all pages (cap to keep it fast)
    const ext = new Set();
    for (const p of this.results) {
      (p.externalLinks || []).forEach(l => ext.add(l));
    }
    const list = [...ext].slice(0, 300);
    const statusMap = {};

    const tasks = list.map(url => limit(async () => {
      if (this.stopped) return;
      const r = await this.checkStatus(url);
      statusMap[url] = r.status;
    }));
    await Promise.all(tasks);

    // Attach broken external link info to pages
    for (const p of this.results) {
      p.brokenExternalLinks = (p.externalLinks || []).filter(l => {
        const s = statusMap[l];
        return s === 0 || (s >= 400);
      });
    }
    this.externalStatusMap = statusMap;
  }
}

module.exports = Crawler;
