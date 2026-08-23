````markdown
# FlyRank Internship — W5 A9: The Polite Scraper

A small, polite web-scraping pipeline built with Node.js.

It discovers books from the first three catalogue pages of Books to Scrape, extracts book details, normalizes and validates the data, handles failed pages without crashing, caches downloaded HTML, and produces a run report.

## Requirements

- Node.js 20+
- npm
- Git

No database, paid API, proxy, cloud service, or credit card is required.

---

## Target Classification

### Target

[Books to Scrape](https://books.toscrape.com/)

Books to Scrape is a public practice sandbox specifically designed for learning and testing web scraping.

### Scope

The scraper processes only the first **3 catalogue pages** and discovers **60 unique book URLs** from those pages.

It does not hardcode the 60 book URLs. Instead, it follows the catalogue's own pagination links.

### Robots.txt Check

I checked:

https://books.toscrape.com/robots.txt

No robots file was found.

A missing robots.txt file is not treated as general permission to scrape other websites. This assignment only targets the Books to Scrape practice sandbox specified for scraping practice.

### Responsible Scraping

I will not reuse this code on another site without checking its rules and terms first.

---

## Installation

Clone the repository and enter the project directory:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd scraper
````

Install dependencies:

```bash
npm install
```

---

## Run

Run the scraper with:

```bash
node src/index.js
```

The scraper processes the first three catalogue pages and their 60 book pages.

The downloaded HTML is cached locally, so subsequent development runs primarily read from the cache instead of repeatedly requesting the website.

---

## Pipeline

The scraper follows this flow:

```text
Classify
   ↓
Fetch
   ↓
Cache
   ↓
Discover 3 catalogue pages
   ↓
Discover 60 unique book URLs
   ↓
Extract book details
   ↓
Normalize values
   ↓
Validate with Zod
   ↓
Store valid records
   ↓
Report failures
```

---

## Politeness Rules

The scraper follows these rules:

* Uses an identifying `User-Agent`.
* Uses a 5-second request timeout.
* Checks the HTTP status code before processing a response.
* Waits at least 500 ms between real requests.
* Uses cached HTML during development when available.
* Does not retry 403 or 404 responses.
* Retries timeout/server-error requests once.
* Does not dump entire HTML pages into the terminal.

---

## Extracted Fields

Each book record contains:

| Field               | Description                                  |
| ------------------- | -------------------------------------------- |
| `title`             | Book title                                   |
| `product_url`       | Absolute URL of the book                     |
| `price_text`        | Original price text                          |
| `price_gbp`         | Normalized numeric price                     |
| `availability_text` | Original availability information            |
| `rating_text`       | Book rating                                  |
| `description`       | Book description, or `null` when unavailable |
| `source_page`       | Catalogue page where the book was discovered |
| `fetched_at`        | Time the book record was fetched             |

---

## Validation

Records are validated with **Zod** before being stored.

The schema checks:

* Required fields are present.
* Strings contain valid values.
* `product_url` uses HTTPS.
* `price_gbp` is a number.
* `source_page` is a valid URL.
* `fetched_at` is a valid datetime.
* Missing descriptions may be stored as `null`.

Records that fail validation are written to:

```text
output/errors.json
```

Valid records are written to:

```text
output/books.json
```

---

## Idempotency

Running the scraper again does not append duplicate records.

`books.json` contains exactly **60 unique records** after a successful run and remains at 60 records after a rerun.

The scraper also uses cached HTML during development, reducing unnecessary requests to the target site.

---

## Failure Handling

Each book page is processed independently.

If one page fails, the error is recorded and the scraper continues processing the remaining pages.

The assignment's failure test used a deliberately fake book URL. The scraper skipped the failed page while preserving the 60 valid book records.

Timeouts and 5xx server errors are retried once.

403 and 404 responses are not retried.

---

## Output

The scraper produces:

```text
output/
├── books.json
├── errors.json
└── run-report.json
```

### Run Report

A real run produces a report similar to:

```json
{
  "start_time": "2026-08-23T10:15:43.112Z",
  "duration_seconds": 33.31,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

---

## Why No Browser?

A browser is unnecessary for the core assignment because the required book data is already present in the HTML returned by the server.

Using a normal HTTP request is cheaper and simpler than launching a browser when JavaScript rendering is not required.

---

## Limitation

The scraper is intentionally limited to the first three catalogue pages and depends on the current HTML structure and CSS selectors of Books to Scrape.

If the site's HTML structure changes, the selectors may need to be updated.

---

## Ethics

When scraping websites:

* Use an official API when one exists.
* Respect the site's rules and terms.
* Do not bypass logins, paywalls, or access blocks.
* Collect only the data that is necessary.
* Identify automated requests honestly.
* Rate-limit requests and avoid unnecessary traffic.

---

## Project Structure

```text
scraper/
├── src/
│   └── index.js
├── cache/
│   └── ignored local HTML cache
├── output/
│   ├── books.json
│   ├── errors.json
│   └── run-report.json
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

The `cache/` directory is excluded from GitHub using `.gitignore`.

---

## Technologies

* Node.js
* JavaScript
* Cheerio
* Zod
* Git
* GitHub

````
