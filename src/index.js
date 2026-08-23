const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCacheFile(name) {
    return path.join(CACHE_DIR, name);
}

async function fetchPage(url, cacheName) {
    const cacheFile = getCacheFile(cacheName);

    if (fs.existsSync(cacheFile)) {
        const html = fs.readFileSync(cacheFile, "utf8");
        console.log(`CACHE HIT: ${cacheName}`);
        return html;
    }

    console.log(`FETCH: ${url}`);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent":
                    "FlyRankInternship-A9/1.0 (+https://github.com/)"
            }
        });

        if (response.status !== 200) {
            throw new Error(
                `Fetch failed with status ${response.status}`
            );
        }

        const html = await response.text();

        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile, html);

        return html;
    } finally {
        clearTimeout(timeout);
    }
}

async function discoverBooks() {
    let currentUrl = BASE_URL;
    let cataloguePage = 1;

    const allBookUrls = [];
    const sourcePages = new Map();

    while (cataloguePage <= 3) {
        const html = await fetchPage(
            currentUrl,
            `catalogue-page-${cataloguePage}.html`
        );

        const $ = cheerio.load(html);

        $("article.product_pod h3 a").each((index, element) => {
            const href = $(element).attr("href");

            if (href) {
                const absoluteUrl = new URL(
                    href,
                    currentUrl
                ).href;

                allBookUrls.push(absoluteUrl);
                sourcePages.set(absoluteUrl, currentUrl);
            }
        });

        const nextHref = $("li.next a").attr("href");

        if (!nextHref || cataloguePage === 3) {
            break;
        }

        await sleep(500);

        currentUrl = new URL(
            nextHref,
            currentUrl
        ).href;

        cataloguePage++;
    }

    const uniqueUrls = [...new Set(allBookUrls)];

    console.log(`catalogue_pages=${cataloguePage}`);
    console.log(`discovered=${allBookUrls.length}`);
    console.log(`unique_urls=${uniqueUrls.length}`);

    return {
        uniqueUrls,
        sourcePages
    };
}

async function extractBook(url, sourcePage, index) {
    const cacheName = `book-${index + 1}.html`;

    const html = await fetchPage(url, cacheName);

    const $ = cheerio.load(html);

    const title = $("div.product_main h1").text().trim() || null;

    const priceText =
        $("div.product_main .price_color")
            .first()
            .text()
            .trim() || null;

    const availabilityText =
        $("div.product_main .availability")
            .text()
            .replace(/\s+/g, " ")
            .trim() || null;

    const ratingText =
        $("div.product_main p.star-rating")
            .attr("class")
            ?.replace("star-rating", "")
            .trim() || null;

    const description =
        $("#product_description")
            .next("p")
            .text()
            .trim() || null;

    return {
        title,
        product_url: url,
        price_text: priceText,
        availability_text: availabilityText,
        rating_text: ratingText,
        description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString()
    };
}

async function main() {
    const { uniqueUrls, sourcePages } = await discoverBooks();

    const records = [];

    for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];

        try {
            const record = await extractBook(
                url,
                sourcePages.get(url),
                i
            );

            records.push(record);

            if (i < uniqueUrls.length - 1) {
                await sleep(500);
            }
        } catch (error) {
            console.error(
                `FAILED: ${url} - ${error.message}`
            );
        }
    }

    console.log(`detail_pages=${records.length}`);

    console.log("\nFirst raw record:");
    console.log(JSON.stringify(records[0], null, 2));
}

main().catch(error => {
    console.error("ERROR:", error.message);
    process.exit(1);
});