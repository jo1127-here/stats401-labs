import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
from pathlib import Path


# Find the project root directory
PROJECT_DIR = Path(__file__).resolve().parent.parent

# Create the data folder
DATA_DIR = PROJECT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Output CSV
OUTPUT_FILE = DATA_DIR / "lab3_data.csv"

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

            # Extract only the number from the price
            match = re.search(r"\d+\.\d+", price_text)

            if match:
                price = float(match.group())
            else:
                print(f"Could not read price: {price_text}")
                continue

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

        # Basic rate limiting
        time.sleep(1)

    except requests.RequestException as e:
        print(f"Error accessing page {page}: {e}")

    except Exception as e:
        print(f"Error processing page {page}: {e}")


# Create DataFrame
df = pd.DataFrame(records)

print()
print("Total records:", len(df))

# Save CSV
df.to_csv(OUTPUT_FILE, index=False)

print(f"CSV saved to: {OUTPUT_FILE}")
        books = soup.select("article.product_pod")

        for book in books:

            # Title
            title = book.select_one("h3 a")["title"]

            # Price
            price_text = book.select_one(
                ".price_color"
            ).get_text(strip=True)

            # Extract only the number from the price
            match = re.search(r"\d+\.\d+", price_text)

            if match:
                price = float(match.group())
            else:
                print(f"Could not read price: {price_text}")
                continue

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

        # Basic rate limiting
        time.sleep(1)

    except requests.RequestException as e:
        print(f"Error accessing page {page}: {e}")

    except Exception as e:
        print(f"Error processing page {page}: {e}")


# Create DataFrame
df = pd.DataFrame(records)

print()
print("Total records:", len(df))

# Save CSV
df.to_csv(OUTPUT_FILE, index=False)

print(f"CSV saved to: {OUTPUT_FILE}")
