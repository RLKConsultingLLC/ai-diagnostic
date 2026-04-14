// =============================================================================
// RLK AI Diagnostic — Public Data Source Fetchers
// =============================================================================
// Fetches company data from public sources: SEC EDGAR, news APIs, etc.
// Each fetcher returns structured data that feeds into Claude synthesis.
// =============================================================================

import { CompanyProfile, Industry } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// SEC EDGAR — 10-K / 10-Q Filings
// ---------------------------------------------------------------------------

export interface SECFiling {
  formType: string;
  filedDate: string;
  accessionNumber: string;
  primaryDocument: string;
  filingUrl: string;
}

export async function searchSECFilings(
  companyName: string,
  ticker?: string
): Promise<SECFiling[]> {
  try {
    // SEC EDGAR full-text search API (free, no auth required)
    const query = ticker || companyName;
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22&dateRange=custom&startdt=${getOneYearAgo()}&enddt=${getToday()}&forms=10-K,10-Q,8-K&hits.hits.total.value=10`;

    const response = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22&forms=10-K,10-Q&dateRange=custom&startdt=${getOneYearAgo()}&enddt=${getToday()}`,
      {
        headers: {
          'User-Agent': 'RLK Consulting research@rlkconsultingco.com',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Fallback to EDGAR company search
      return await searchEDGARCompany(query);
    }

    const data = await response.json();
    const filings: SECFiling[] = (data.hits?.hits || []).map((hit: Record<string, unknown>) => {
      const source = hit._source as Record<string, unknown>;
      return {
        formType: (source.form_type as string) || '',
        filedDate: (source.file_date as string) || '',
        accessionNumber: (source.accession_no as string) || '',
        primaryDocument: (source.file_name as string) || '',
        filingUrl: `https://www.sec.gov/Archives/edgar/data/${source.entity_id}/${source.accession_no}`,
      };
    });

    return filings.slice(0, 5);
  } catch {
    return [];
  }
}

async function searchEDGARCompany(query: string): Promise<SECFiling[]> {
  try {
    const response = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22&forms=10-K,10-Q`,
      {
        headers: {
          'User-Agent': 'RLK Consulting research@rlkconsultingco.com',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();

    return (data.hits?.hits || []).slice(0, 3).map((hit: Record<string, unknown>) => {
      const source = hit._source as Record<string, unknown>;
      return {
        formType: (source.form_type as string) || '10-K',
        filedDate: (source.file_date as string) || '',
        accessionNumber: (source.accession_no as string) || '',
        primaryDocument: '',
        filingUrl: '',
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// NEWS SEARCH — Uses public news APIs
// ---------------------------------------------------------------------------

export interface RawNewsResult {
  title: string;
  source: string;
  publishedAt: string;
  description: string;
  url: string;
}

export async function searchCompanyNews(
  companyName: string,
  _industry: string
): Promise<RawNewsResult[]> {
  const results: RawNewsResult[] = [];

  // Strategy 1: Google News RSS (free, no auth)
  try {
    const googleNewsResults = await fetchGoogleNewsRSS(companyName);
    results.push(...googleNewsResults);
  } catch {
    // Continue with other sources
  }

  // Strategy 2: AI-specific news search
  try {
    const aiNewsResults = await fetchGoogleNewsRSS(`${companyName} artificial intelligence`);
    results.push(...aiNewsResults);
  } catch {
    // Continue
  }

  // Strategy 3: Leadership/strategy news
  try {
    const strategyResults = await fetchGoogleNewsRSS(`${companyName} CEO strategy technology`);
    results.push(...strategyResults);
  } catch {
    // Continue
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchGoogleNewsRSS(query: string): Promise<RawNewsResult[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'RLK Consulting research@rlkconsultingco.com' },
    });

    if (!response.ok) return [];
    const xml = await response.text();

    // Simple XML parsing for RSS items
    const items: RawNewsResult[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const title = extractXmlTag(itemXml, 'title');
      const source = extractXmlTag(itemXml, 'source');
      const pubDate = extractXmlTag(itemXml, 'pubDate');
      const description = extractXmlTag(itemXml, 'description');
      const link = extractXmlTag(itemXml, 'link');

      if (title) {
        items.push({
          title: decodeHtmlEntities(title),
          source: source || 'Google News',
          publishedAt: pubDate || '',
          description: decodeHtmlEntities(description || '').replace(/<[^>]*>/g, ''),
          url: link || '',
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

// ---------------------------------------------------------------------------
// INDUSTRY CONTEXT
// ---------------------------------------------------------------------------

export async function searchIndustryNews(industry: Industry): Promise<RawNewsResult[]> {
  const industryTerms: Record<string, string> = {
    financial_services: 'financial services AI artificial intelligence banking',
    insurance: 'insurance AI artificial intelligence insurtech',
    healthcare: 'healthcare AI artificial intelligence health tech',
    manufacturing: 'manufacturing AI artificial intelligence industry 4.0',
    technology: 'enterprise technology AI artificial intelligence',
    retail_ecommerce: 'retail ecommerce AI artificial intelligence',
    professional_services: 'professional services consulting AI artificial intelligence',
    energy_utilities: 'energy utilities AI artificial intelligence',
    government: 'government AI artificial intelligence public sector',
    education: 'education AI artificial intelligence edtech',
    media_entertainment: 'media entertainment AI artificial intelligence',
    other: 'enterprise AI artificial intelligence',
  };

  const query = industryTerms[industry] || industryTerms.other;

  try {
    return await fetchGoogleNewsRSS(query);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// COMPANY WEBSITE INTELLIGENCE
// ---------------------------------------------------------------------------

export async function fetchCompanyWebContent(
  companyName: string,
  websiteUrl?: string
): Promise<{ aboutText: string; newsroomItems: string[]; aiReferences: string[] }> {
  // Try to find and fetch the company's about/news pages
  const result = { aboutText: '', newsroomItems: [] as string[], aiReferences: [] as string[] };

  // If we have a direct website URL, try to fetch about/newsroom content from it
  if (websiteUrl) {
    try {
      const baseUrl = websiteUrl.replace(/\/$/, '');
      const aboutResponse = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'RLK Consulting research@rlkconsultingco.com',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (aboutResponse.ok) {
        const html = await aboutResponse.text();
        // Extract text content, strip tags, limit length
        const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        result.aboutText = textContent.slice(0, 2000);
      }
    } catch {
      // Fall through to news-based research
    }
  }

  try {
    // Search for company newsroom/press releases
    const newsroomResults = await fetchGoogleNewsRSS(`${companyName} press release announcement`);
    result.newsroomItems = newsroomResults.slice(0, 5).map((n) => `${n.title} (${n.publishedAt})`);

    // Search for AI-specific announcements
    const aiResults = await fetchGoogleNewsRSS(`${companyName} AI machine learning announcement`);
    result.aiReferences = aiResults.slice(0, 5).map((n) => n.title);
  } catch {
    // Continue with empty results
  }

  return result;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getOneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}
