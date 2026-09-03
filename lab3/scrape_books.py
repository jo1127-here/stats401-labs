import requests
from bs4 import BeautifulSoup
import pandas as pd
import time


BASE_URL = "https://books.toscrape.com/catalogue/page-{}.html"

records = []

for page in range(1, 51):

    url = BASE_URL.format(page)

    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 STATS401-Lab3"
            },
            timeout=10
        )

        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        books = soup.select("article.product_pod")

        for book in books:

            title = book.select_one("h3 a")["title"]

            price_text = book.select_one(".price_color").get_text(strip=True)
            price = float(price_text.replace("£", ""))

            rating_classes = book.select_one(
                "p.star-rating"
            ).get("class", [])

            rating = ""

            for r in ["One", "Two", "Three", "Four", "Five"]:
                if r in rating_classes:
                    rating = r
                    break

            records.append({
                "title": title,
                "price": price,
                "rating": rating,
                "page": page
            })

        print(f"Page {page}: {len(books)} books collected")

        # Basic rate limiting
        time.sleep(1)

    except requests.RequestException as e:
        print(f"Error accessing page {page}: {e}")

    except Exception as e:
        print(f"Error processing page {page}: {e}")


# Convert to DataFrame
df = pd.DataFrame(records)

print("\nTotal records:", len(df))

# Save CSV
df.to_csv("../data/lab3_data.csv", index=False)

print("CSV saved to ../data/lab3_data.csv")
