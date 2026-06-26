const translations = {
  en: {
    dir: 'ltr',
    appTitle: 'SEO Audit Pro',
    tagline: 'Enterprise SEO & Link Crawler',
    urlPlaceholder: 'Enter website URL (e.g. example.com)',
    depth: 'Crawl Depth',
    concurrency: 'Concurrency',
    maxPages: 'Max Pages',
    startCrawl: 'Start Crawl',
    stopCrawl: 'Stop',
    pagesScanned: 'Pages Scanned',
    brokenLinks: 'Broken Links',
    errors: 'Errors',
    queued: 'Queued',
    siteHealth: 'Site Health',
    seoScore: 'SEO Score',
    performance: 'Performance',
    statusDist: 'Status Distribution',
    seoIssues: 'SEO Issues',
    crawlProgress: 'Crawl Progress',
    insights: 'SEO Insights',
    results: 'Results',
    search: 'Search URLs...',
    exportCSV: 'Export CSV',
    exportJSON: 'Export JSON',
    exportHTML: 'Export HTML',
    colUrl: 'URL',
    colStatus: 'Code',
    colLabel: 'Status',
    colTitle: 'Title',
    colMeta: 'Meta',
    colH1: 'H1',
    colTime: 'Time',
    colDepth: 'Depth',
    colIssues: 'Issues',
    ready: 'Ready',
    crawling: 'Crawling...',
    done: 'Crawl complete',
    yes: 'Yes', no: 'No', ok: 'OK',
    allStatus: 'All', filterBroken: 'Broken only', filterRedirect: 'Redirects',
    saved: 'Report saved to'
  },
  fa: {
    dir: 'rtl',
    appTitle: 'سئو ادیت پرو',
    tagline: 'خزنده و آنالیزگر حرفه‌ای سئو',
    urlPlaceholder: 'آدرس سایت را وارد کنید (مثال: example.com)',
    depth: 'عمق خزش',
    concurrency: 'همزمانی',
    maxPages: 'حداکثر صفحات',
    startCrawl: 'شروع خزش',
    stopCrawl: 'توقف',
    pagesScanned: 'صفحات اسکن‌شده',
    brokenLinks: 'لینک‌های خراب',
    errors: 'خطاها',
    queued: 'در صف',
    siteHealth: 'سلامت سایت',
    seoScore: 'امتیاز سئو',
    performance: 'عملکرد',
    statusDist: 'توزیع وضعیت',
    seoIssues: 'مشکلات سئو',
    crawlProgress: 'پیشرفت خزش',
    insights: 'تحلیل‌های سئو',
    results: 'نتایج',
    search: 'جستجوی آدرس...',
    exportCSV: 'خروجی CSV',
    exportJSON: 'خروجی JSON',
    exportHTML: 'خروجی HTML',
    colUrl: 'آدرس',
    colStatus: 'کد',
    colLabel: 'وضعیت',
    colTitle: 'عنوان',
    colMeta: 'متا',
    colH1: 'H1',
    colTime: 'زمان',
    colDepth: 'عمق',
    colIssues: 'مشکلات',
    ready: 'آماده',
    crawling: 'در حال خزش...',
    done: 'خزش کامل شد',
    yes: 'بله', no: 'خیر', ok: 'سالم',
    allStatus: 'همه', filterBroken: 'فقط خراب', filterRedirect: 'ریدایرکت‌ها',
    saved: 'گزارش ذخیره شد در'
  },
  ar: {
    dir: 'rtl',
    appTitle: 'تدقيق السيو برو',
    tagline: 'زاحف ومحلل احترافي للسيو',
    urlPlaceholder: 'أدخل عنوان الموقع (مثال: example.com)',
    depth: 'عمق الزحف',
    concurrency: 'التزامن',
    maxPages: 'أقصى عدد صفحات',
    startCrawl: 'بدء الزحف',
    stopCrawl: 'إيقاف',
    pagesScanned: 'الصفحات الممسوحة',
    brokenLinks: 'روابط معطلة',
    errors: 'أخطاء',
    queued: 'في الانتظار',
    siteHealth: 'صحة الموقع',
    seoScore: 'نتيجة السيو',
    performance: 'الأداء',
    statusDist: 'توزيع الحالة',
    seoIssues: 'مشاكل السيو',
    crawlProgress: 'تقدم الزحف',
    insights: 'رؤى السيو',
    results: 'النتائج',
    search: 'بحث في الروابط...',
    exportCSV: 'تصدير CSV',
    exportJSON: 'تصدير JSON',
    exportHTML: 'تصدير HTML',
    colUrl: 'الرابط',
    colStatus: 'الكود',
    colLabel: 'الحالة',
    colTitle: 'العنوان',
    colMeta: 'الوصف',
    colH1: 'H1',
    colTime: 'الوقت',
    colDepth: 'العمق',
    colIssues: 'المشاكل',
    ready: 'جاهز',
    crawling: 'جاري الزحف...',
    done: 'اكتمل الزحف',
    yes: 'نعم', no: 'لا', ok: 'سليم',
    allStatus: 'الكل', filterBroken: 'المعطلة فقط', filterRedirect: 'إعادة التوجيه',
    saved: 'تم حفظ التقرير في'
  }
};

let currentLang = 'en';

function setLang(lang) {
  currentLang = translations[lang] ? lang : 'en';
  const t = translations[currentLang];
  document.documentElement.lang = currentLang;
  document.documentElement.dir = t.dir;
  document.body.classList.toggle('rtl', t.dir === 'rtl');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (t[key]) el.placeholder = t[key];
  });
  return t;
}

function tr(key) {
  return translations[currentLang][key] || key;
}

window.i18n = { setLang, tr, getLang: () => currentLang };
