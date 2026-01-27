import Parser from 'rss-parser';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['image', 'image']
    ],
  }
});

async function getHighQualityImage(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const $ = cheerio.load(data);
    const ogImage = $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="image_src"]').attr('href');

    // NORMALIZE: Ensure absolute URL
    if (ogImage && ogImage.startsWith('/')) {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${ogImage}`;
    }
    return ogImage;
  } catch (error) {
    console.error(`[Scraper] Could not fetch page for image: ${url}`);
    return null;
  }
}

export async function fetchNews() {
  const sourcesPath = path.resolve(process.cwd(), 'data/sources.json');
  const sourcesData = await fs.readFile(sourcesPath, 'utf8');
  const sources = JSON.parse(sourcesData);

  let allArticles = [];

  for (const source of sources) {
    try {
      console.log(`[Scraper] Fetching from ${source.name}...`);
      const feed = await parser.parseURL(source.url);

      const articles = [];
      for (const item of feed.items.slice(0, 10)) { // limit per source to save time
        // 1. Try to extract image from RSS first as fallback
        let imageUrl = null;
        if (item.mediaContent && item.mediaContent[0] && item.mediaContent[0].$) {
          imageUrl = item.mediaContent[0].$.url;
        } else if (item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        }

        // 2. IMPORTANT: Visit the actual website to get the HIGH QUALITY "og:image"
        const hqImage = await getHighQualityImage(item.link);
        if (hqImage) imageUrl = hqImage;

        articles.push({
          title: item.title,
          description: item.contentSnippet || item.content || item.description || '',
          url: item.link,
          pubDate: item.pubDate,
          source: source.name,
          sourceType: source.category,
          originalLanguage: source.language,
          imageUrl: imageUrl
        });
      }

      allArticles = [...allArticles, ...articles];
    } catch (error) {
      console.error(`[Scraper] Error fetching from ${source.name}:`, error.message);
    }
  }

  return allArticles;
}
