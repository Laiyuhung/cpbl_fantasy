import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET() {
    let browser = null;

    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Scrape both sites in parallel
        const [tradEadData, ticketJamData] = await Promise.all([
            scrapeTradEad(browser),
            scrapeTicketJam(browser)
        ]);

        return NextResponse.json({
            tradEad: tradEadData,
            ticketJam: ticketJamData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error scraping tickets:', error);
        return NextResponse.json(
            { error: 'Failed to scrape ticket data', details: error.message },
            { status: 500 }
        );
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function scrapeTradEad(browser) {
    const page = await browser.newPage();

    try {
        await page.goto('https://tradead.tixplus.jp/wbc2026/buy/bidding/listings/1517?order=1', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        await page.waitForSelector('body', { timeout: 10000 });

        // Extract ticket listings
        const listings = await page.evaluate(() => {
            const results = [];

            // Try to find ticket listing elements (adjust selectors based on actual page structure)
            const listingElements = document.querySelectorAll('.listing-item, .ticket-item, [class*="listing"], [class*="ticket"]');

            if (listingElements.length === 0) {
                // If no specific listings found, try to get general info
                const bodyText = document.body.innerText;
                return [{
                    rawContent: bodyText.substring(0, 500) // First 500 chars as fallback
                }];
            }

            listingElements.forEach((element, index) => {
                const listing = {};

                // Extract text content
                const text = element.innerText || element.textContent;

                // Try to find price
                const priceMatch = text.match(/[¥￥]\s*[\d,]+/);
                if (priceMatch) {
                    listing.price = priceMatch[0];
                }

                // Try to find quantity/availability
                const quantityMatch = text.match(/(\d+)\s*(枚|tickets?|seats?)/i);
                if (quantityMatch) {
                    listing.quantity = quantityMatch[0];
                }

                // Try to find section/seat info
                const sectionMatch = text.match(/(Section|座席|ブロック)[:\s]*([A-Z0-9]+)/i);
                if (sectionMatch) {
                    listing.section = sectionMatch[2];
                }

                // Add raw text if we found something
                if (Object.keys(listing).length > 0 || index < 5) {
                    listing.rawText = text.substring(0, 200);
                    results.push(listing);
                }
            });

            return results.length > 0 ? results : [{ message: 'No listings found' }];
        });

        return {
            success: true,
            listings,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('TradEad scraping error:', error);
        return {
            success: false,
            error: error.message,
            listings: []
        };
    } finally {
        await page.close();
    }
}

async function scrapeTicketJam(browser) {
    const page = await browser.newPage();

    try {
        await page.goto('https://ticketjam.jp/tickets/wbc/event_groups/279318', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        await page.waitForSelector('body', { timeout: 10000 });

        // Extract event/ticket information
        const events = await page.evaluate(() => {
            const results = [];

            // Try to find event/ticket elements (adjust selectors based on actual page structure)
            const eventElements = document.querySelectorAll('.event-item, .ticket-card, [class*="event"], [class*="ticket"]');

            if (eventElements.length === 0) {
                // If no specific events found, try to get general info
                const bodyText = document.body.innerText;
                return [{
                    rawContent: bodyText.substring(0, 500) // First 500 chars as fallback
                }];
            }

            eventElements.forEach((element, index) => {
                const event = {};

                // Extract text content
                const text = element.innerText || element.textContent;

                // Try to find event name/title
                const titleElement = element.querySelector('h1, h2, h3, h4, .title, [class*="title"]');
                if (titleElement) {
                    event.title = titleElement.innerText.trim();
                }

                // Try to find price
                const priceMatch = text.match(/[¥￥]\s*[\d,]+/);
                if (priceMatch) {
                    event.price = priceMatch[0];
                }

                // Try to find date
                const dateMatch = text.match(/\d{4}[年/-]\d{1,2}[月/-]\d{1,2}/);
                if (dateMatch) {
                    event.date = dateMatch[0];
                }

                // Try to find availability status
                if (text.includes('売り切れ') || text.includes('完売') || text.includes('sold out')) {
                    event.status = 'Sold Out';
                } else if (text.includes('販売中') || text.includes('available')) {
                    event.status = 'Available';
                }

                // Add raw text if we found something
                if (Object.keys(event).length > 0 || index < 5) {
                    event.rawText = text.substring(0, 200);
                    results.push(event);
                }
            });

            return results.length > 0 ? results : [{ message: 'No events found' }];
        });

        return {
            success: true,
            events,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('TicketJam scraping error:', error);
        return {
            success: false,
            error: error.message,
            events: []
        };
    } finally {
        await page.close();
    }
}
