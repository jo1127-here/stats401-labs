import requests
from bs4 import BeautifulSoup
import pandas as pd
import time


BASE_URL = "https://books.toscrape.com/catalogue/page-{}.html"

records = []

# Books to Scrape has 20 books per page.
# 50 pages × 20 books = 1,000 books.
for page in range(1, 51):

    url = BASE_URL.format(page)

    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": "STATS401-Class-Exercise/1.0"
            },
            timeout=10
        )

        response.raise_for_status()

    except requests.RequestException as error:
        print(f"Failed to download page {page}: {error}")
        continue

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    books = soup.select("article.product_pod")

    for book in books:

        title_element = book.select_one("h3 a")
        price_element = book.select_one(".price_color")
        rating_element = book.select_one("p.star-rating")

        if title_element is None:
            continue

        title = title_element.get("title", "")

        price_text = price_element.get_text(strip=True)
        price = float(
            price_text.replace("£", "")
        )

        rating_classes = rating_element.get("class", [])
        rating = ""

        for value in ["One", "Two", "Three", "Four", "Five"]:
            if value in rating_classes:
                rating = value
                break

        records.append({
            "title": title,
            "price": price,
            "rating": rating,
            "page": page
        })

    print(
        f"Page {page} complete. "
        f"Total records: {len(records)}"
    )

    # Basic rate limiting
    time.sleep(1)


# Convert to DataFrame
df = pd.DataFrame(records)

# Keep exactly 1,000 records
df = df.head(1000)

print("\nFinal dataset:")
print(df.head())

print("\nNumber of records:", len(df))
print("Number of columns:", len(df.columns))

# Save CSV
df.to_csv(
    "../data/lab3_data.csv",
    index=False
)

print("\nSaved to ../data/lab3_data.csv")
