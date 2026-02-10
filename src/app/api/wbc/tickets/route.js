import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Vercel serverless function configuration
export const maxDuration = 30; // Reduced since cheerio is much faster
export const dynamic = 'force-dynamic';

// In-memory cache to avoid scraping too frequently
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    // Check cache first
    const now = Date.now();
    if (cachedData && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
        return NextResponse.json({
            ...cachedData,
            cached: true,
            cacheAge: Math.floor((now - cacheTimestamp) / 1000) + 's'
        });
    }

    try {
        // Scrape both sites in parallel
        const [tradEadData, ticketJamData] = await Promise.all([
            scrapeTradEad(),
            scrapeTicketJam()
        ]);

        const responseData = {
            tradEad: tradEadData,
            ticketJam: ticketJamData,
            timestamp: new Date().toISOString(),
            cached: false
        };

        // Update cache
        cachedData = responseData;
        cacheTimestamp = Date.now();

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Error scraping tickets:', error);
        return NextResponse.json(
            { error: 'Failed to scrape ticket data', details: error.message },
            { status: 500 }
        );
    }
}

async function scrapeTradEad() {
    try {
        const response = await fetch('https://tradead.tixplus.jp/wbc2026/buy/bidding/listings/1517?order=1', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract page title
        const pageTitle = $('title').text().trim();

        // Extract main content text (first 2000 characters)
        const bodyText = $('body').text()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);

        // Try to find specific ticket information
        const listings = [];

        // Look for common ticket listing patterns
        $('[class*="listing"], [class*="ticket"], [class*="item"]').each((i, elem) => {
            if (i < 10) { // Limit to first 10 items
                const text = $(elem).text().replace(/\s+/g, ' ').trim();
                if (text.length > 20 && text.length < 500) {
                    listings.push(text);
                }
            }
        });

        return {
            success: true,
            pageTitle,
            bodyPreview: bodyText,
            listings: listings.length > 0 ? listings : ['未找到具體票券列表'],
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('TradEad scraping error:', error);
        return {
            success: false,
            error: error.message,
            pageTitle: 'Error',
            bodyPreview: '',
            listings: []
        };
    }
}

async function scrapeTicketJam() {
    try {
        const response = await fetch('https://ticketjam.jp/tickets/wbc/event_groups/279318', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract page title
        const pageTitle = $('title').text().trim();

        // Extract main content text (first 2000 characters)
        const bodyText = $('body').text()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);

        // Try to find specific event/ticket information
        const events = [];

        // Look for common event/ticket patterns
        $('[class*="event"], [class*="ticket"], [class*="card"], [class*="item"]').each((i, elem) => {
            if (i < 10) { // Limit to first 10 items
                const text = $(elem).text().replace(/\s+/g, ' ').trim();
                if (text.length > 20 && text.length < 500) {
                    events.push(text);
                }
            }
        });

        return {
            success: true,
            pageTitle,
            bodyPreview: bodyText,
            events: events.length > 0 ? events : ['未找到具體活動列表'],
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('TicketJam scraping error:', error);
        return {
            success: false,
            error: error.message,
            pageTitle: 'Error',
            bodyPreview: '',
            events: []
        };
    }
}
