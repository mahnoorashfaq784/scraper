const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { z } = require("zod");

const BASE_URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");

const bookSchema = z.object({
    title: z.string().min(1),
    product_url: z.string().url().startsWith("https://"),
    price_text: z.string().min(1),
    price_gbp: z.number(),
    availability_text: z.string().min(1),
    rating_text: z.string().min(1),
    description: z.string().nullable(),
    source_page: z.string().url(),
    fetched_at: z.string().datetime()
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCacheFile(name) {
    return path.join(CACHE_DIR, name);
}

async function fetchPage(url, cacheName, stats) {
    const cacheFile = getCacheFile(cacheName);

    if (fs.existsSync(cacheFile)) {
        const html = fs.readFileSync(cacheFile, "utf8");

        stats.cacheHits++;

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
            const error = new Error(
                `Fetch failed with status ${response.status}`
            );

            error.status = response.status;

            throw error;
        }

        const html = await response.text();

        stats.pagesFetched++;

        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile, html);

        return html;

    } finally {
        clearTimeout(timeout);
    }
}

async function fetchWithRetry(url, cacheName, stats) {
    try {
        return await fetchPage(url, cacheName, stats);

    } catch (error) {

        // Retry only timeout or server errors (5xx)
        if (error.name === "AbortError" ||
            (error.status >= 500 && error.status <= 599)) {

            console.log(`RETRY: ${url}`);

            await sleep(1000);

            return await fetchPage(url, cacheName, stats);
        }

        // Do not retry 403, 404, or other errors
        throw error;
    }
}

async function discoverBooks(stats) {
    let currentUrl = BASE_URL;
    let cataloguePage = 1;

    const allBookUrls = [];
    const sourcePages = new Map();

    while (cataloguePage <= 3) {

        const html = await fetchWithRetry(
            currentUrl,
            `catalogue-page-${cataloguePage}.html`,
            stats
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

                sourcePages.set(
                    absoluteUrl,
                    currentUrl
                );
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

function normalizePrice(priceText) {

    if (!priceText) {
        return null;
    }

    const cleaned = priceText
        .replace("£", "")
        .trim();

    const price = Number(cleaned);

    return Number.isFinite(price)
        ? price
        : null;
}

async function extractBook(url, sourcePage, index, stats) {

    const cacheName = `book-${index + 1}.html`;

    const html = await fetchWithRetry(
        url,
        cacheName,
        stats
    );

    const $ = cheerio.load(html);

    const title =
        $("div.product_main h1")
            .text()
            .trim() || null;

    const priceText =
        $("div.product_main .price_color")
            .first()
            .text()
            .trim() || null;

    const priceGbp =
        normalizePrice(priceText);

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
        price_gbp: priceGbp,
        availability_text: availabilityText,
        rating_text: ratingText,
        description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString()
    };
}

async function main() {

    const startTime = new Date();

    const stats = {
        pagesFetched: 0,
        cacheHits: 0
    };

    const errors = [];

    const {
        uniqueUrls,
        sourcePages
    } = await discoverBooks(stats);


    const records = [];

    for (let i = 0; i < uniqueUrls.length; i++) {

        const url = uniqueUrls[i];

        try {

            const record = await extractBook(
                url,
                sourcePages.get(url) || BASE_URL,
                i,
                stats
            );

            const result =
                bookSchema.safeParse(record);

            if (result.success) {

                records.push(result.data);

            } else {

                console.error(`INVALID: ${url}`);

                errors.push({
                    url,
                    errors: result.error.issues
                });
            }

        } catch (error) {

            console.error(
                `FAILED: ${url} - ${error.message}`
            );

            errors.push({
                url,
                errors: [error.message]
            });
        }

        if (i < uniqueUrls.length - 1) {
            await sleep(500);
        }
    }

    const outputDir =
        path.join(__dirname, "..", "output");

    fs.mkdirSync(
        outputDir,
        { recursive: true }
    );

    fs.writeFileSync(
        path.join(outputDir, "books.json"),
        JSON.stringify(records, null, 2)
    );

    fs.writeFileSync(
        path.join(outputDir, "errors.json"),
        JSON.stringify(errors, null, 2)
    );

    const endTime = new Date();

    const durationSeconds =
        (endTime - startTime) / 1000;

    const runReport = {
        start_time: startTime.toISOString(),
        duration_seconds: Number(
            durationSeconds.toFixed(2)
        ),
        pages_fetched: stats.pagesFetched,
        cache_hits: stats.cacheHits,
        valid_records: records.length,
        invalid_records: 0,
        failed_pages: errors.length
    };

    fs.writeFileSync(
        path.join(outputDir, "run-report.json"),
        JSON.stringify(runReport, null, 2)
    );

    console.log("\nRUN REPORT");
    console.log(
        JSON.stringify(runReport, null, 2)
    );
}

main().catch(error => {

    console.error(
        "ERROR:",
        error.message
    );

    process.exit(1);
});