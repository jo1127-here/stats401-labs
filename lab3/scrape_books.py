import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os


# Find the repository folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

# Create data folder if it does not exist
os.makedirs(DATA_DIR, exist_ok=True)

records = []

for page in range(1, 51):

    url = f"https://books.toscrape.com/catalogue/page-{page}.html"

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

            # Title
            title = book.select_one("h3 a")["title"]

            # Price
            price_text = book.select_one(
                ".price_color"
            ).get_text(strip=True)

            # Remove currency symbols and encoding artifact
            price_text = (
                price_text
                .replace("£", "")
                .replace("Â", "")
                .strip()
            )

            price = float(price_text)

            # Rating
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

        # Rate limiting
        time.sleep(1)

    except requests.RequestException as e:
        print(f"Error accessing page {page}: {e}")

    except (ValueError, KeyError, AttributeError) as e:
        print(f"Error processing page {page}: {e}")


# Create DataFrame
df = pd.DataFrame(records)

print("\nTotal records:", len(df))

# Save CSV
output_file = os.path.join(DATA_DIR, "lab3_data.csv")

df.to_csv(output_file, index=False)

print(f"CSV saved to: {output_file}")
