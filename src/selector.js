import fs from 'fs/promises';
import path from 'path';
import { isNew } from './deduplicator.js';
import { detectCategory } from './categoryDetector.js';

const STATE_FILE = path.resolve(process.cwd(), 'data/state.json');

async function getLastSource() {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data).lastSource;
    } catch {
        return null;
    }
}

export async function saveLastSource(source) {
    await fs.writeFile(STATE_FILE, JSON.stringify({ lastSource: source }, null, 2));
}

import { getHighQualityImage } from './scraper.js';

export async function selectBestArticle(articles, targetLanguage) {
    const lastSource = await getLastSource();
    const candidates = [];

    for (const art of articles) {
        // FILTER: Only articles from the last 24 hours
        const now = new Date();
        const pubDate = new Date(art.pubDate);
        const diffMs = now - pubDate;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 24) continue;

        // Solo aceptamos si es nueva
        if (await isNew(art)) {
            const detection = detectCategory(art);

            let finalScore = detection.score;

            // LÓGICA DE VARIEDAD: Penalizamos la última fuente usada para forzar rotación
            if (art.source === lastSource) {
                finalScore -= 40;
            }

            candidates.push({
                ...art,
                category: detection.category,
                score: finalScore
            });
        }
    }

    if (candidates.length === 0) return null;

    // Ordenamos por puntuación y fecha para elegir el mejor
    const bestArticles = candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.pubDate) - new Date(a.pubDate);
    });

    // Intentamos obtener la imagen de alta calidad solo para los mejores candidatos
    // hasta encontrar uno que tenga una imagen válida
    for (const best of bestArticles.slice(0, 5)) {
        console.log(`[Selector] Fetching HQ image for candidate: ${best.title.slice(0, 30)}...`);
        const hqImage = await getHighQualityImage(best.url);
        if (hqImage) {
            return { ...best, imageUrl: hqImage };
        }
        // If best has a fallback image URL from RSS, use it if no HQ found
        if (best.imageUrl) return best;
    }

    return null;
}
