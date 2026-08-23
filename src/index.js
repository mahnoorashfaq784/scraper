const fs = require("fs");
const path = require("path");

const URL = "https://books.toscrape.com/";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

async function fetchPage() {

    if (fs.existsSync(CACHE_FILE)) {
        const html = fs.readFileSync(CACHE_FILE, "utf8");

        console.log("CACHE HIT");
        console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);

        return html;
    }

    console.log("FETCH");

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    try {
        const response = await fetch(URL, {
            signal: controller.signal,
            headers: {
                "User-Agent": "FlyRankInternship-A9/1.0 (+https://github.com/)"
            }
        });

        if (response.status !== 200) {
            throw new Error(`Fetch failed with status ${response.status}`);
        }

        const html = await response.text();

        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, html);

        console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);

        return html;
    } finally {
        clearTimeout(timeout);
    }
}

fetchPage().catch((error) => {
    console.error("ERROR:", error.message);
    process.exit(1);
});