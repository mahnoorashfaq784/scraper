const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");

function getCacheFile(pageNumber) {
    return path.join(
        CACHE_DIR,
        `catalogue-page-${pageNumber}.html`
    );
}

async function fetchPage(url, pageNumber) {
    const cacheFile = getCacheFile(pageNumber);

    // Use cached page if available
    if (fs.existsSync(cacheFile)) {
        const html = fs.readFileSync(cacheFile, "utf8");

        console.log(`CACHE HIT: catalogue page ${pageNumber}`);

        return html;
    }

    console.log(`FETCH: catalogue page ${pageNumber}`);

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function discoverBooks() {
    let currentUrl = BASE_URL;
    let cataloguePage = 1;

    const allBookUrls = [];

    while (cataloguePage <= 3) {
        const html = await fetchPage(
            currentUrl,
            cataloguePage
        );

        const $ = cheerio.load(html);

        // Find every book link on this catalogue page
        $("article.product_pod h3 a").each((index, element) => {
            const href = $(element).attr("href");

            if (href) {
                const absoluteUrl = new URL(
                    href,
                    currentUrl
                ).href;

                allBookUrls.push(absoluteUrl);
            }
        });

        // Find the catalogue's next page
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
}

discoverBooks().catch((error) => {
    console.error("ERROR:", error.message);
    process.exit(1);
});