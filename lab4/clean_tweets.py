import pandas as pd
import re
from transformers import pipeline


# ============================================================
# 1. Load dirty data
# ============================================================

input_file = "data/lab4_dirty_tweets.csv"

df = pd.read_csv(
    input_file,
    encoding="latin-1"
)

print("Original shape:", df.shape)
print(df.head())


# ============================================================
# 2. Check missing values
# ============================================================

print("\nMissing values:")
print(df.isnull().sum())


# ============================================================
# 3. Remove missing tweets
# ============================================================

df = df.dropna(subset=["text"])


# ============================================================
# 4. Remove duplicate tweets
# ============================================================

df = df.drop_duplicates(subset=["tweet_id"])


# ============================================================
# 5. Clean tweet text
# ============================================================

df["text"] = (
    df["text"]
    .astype(str)
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

# Remove empty tweets
df = df[df["text"].str.len() > 0]


# ============================================================
# 6. Convert date
# ============================================================

df["date"] = pd.to_datetime(
    df["date"],
    format="%a %b %d %H:%M:%S %Z %Y",
    errors="coerce"
)

# We do NOT drop rows with invalid dates.
# Date is not required for RoBERTa sentiment analysis.


# ============================================================
# 7. Convert original sentiment labels
# ============================================================

# Sentiment140:
# 0 = Negative
# 2 = Neutral
# 4 = Positive

label_map = {
    0: "Negative",
    2: "Neutral",
    4: "Positive"
}

df["original_sentiment"] = df["target"].map(label_map)


# ============================================================
# 8. Create tweet-level attributes
# ============================================================

# Number of characters
df["tweet_length"] = df["text"].str.len()

# Number of words
df["word_count"] = df["text"].str.split().str.len()


# ============================================================
# 9. Prepare text for RoBERTa
# ============================================================

def prepare_text(text):
    text = str(text)

    # Replace usernames
    text = re.sub(r"@\w+", "@user", text)

    # Replace URLs
    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )

    return text.strip()


df["sentiment_text"] = df["text"].apply(prepare_text)

# Remove any empty sentiment text
df = df[df["sentiment_text"].str.len() > 0]


# ============================================================
# 10. Check number of rows before RoBERTa
# ============================================================

print("\nRows before RoBERTa:", len(df))


# ============================================================
# 11. Load RoBERTa
# ============================================================

print("\nLoading RoBERTa model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest"
)


# ============================================================
# 12. Run sentiment analysis
# ============================================================

print("Running RoBERTa sentiment analysis...")

results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16,
    top_k=None
)


# Check the structure of the first result
print("\nExample RoBERTa result:")
print(results[0])


# ============================================================
# 13. Extract sentiment scores
# ============================================================

negative_scores = []
neutral_scores = []
positive_scores = []
predicted_sentiments = []


for result in results:

    scores = {
        item["label"].lower(): item["score"]
        for item in result
    }

    negative_scores.append(
        scores.get("negative", 0)
    )

    neutral_scores.append(
        scores.get("neutral", 0)
    )

    positive_scores.append(
        scores.get("positive", 0)
    )

    predicted_sentiments.append(
        max(scores, key=scores.get).capitalize()
    )


# Add RoBERTa results to dataframe

df["roberta_negative"] = negative_scores
df["roberta_neutral"] = neutral_scores
df["roberta_positive"] = positive_scores
df["roberta_sentiment"] = predicted_sentiments


# ============================================================
# 14. Create sentiment score
# ============================================================

df["sentiment_score"] = (
    df["roberta_positive"]
    - df["roberta_negative"]
)


# ============================================================
# 15. Keep useful columns
# ============================================================

clean_df = df[
    [
        "tweet_id",
        "date",
        "user",
        "flag",
        "text",
        "target",
        "original_sentiment",
        "tweet_length",
        "word_count",
        "roberta_negative",
        "roberta_neutral",
        "roberta_positive",
        "sentiment_score",
        "roberta_sentiment"
    ]
]


# ============================================================
# 16. Save clean dataset
# ============================================================

output_file = "data/lab4_clean_tweets.csv"

clean_df.to_csv(
    output_file,
    index=False
)


# ============================================================
# 17. Print results
# ============================================================

print("\n================================")
print("Cleaning completed!")
print("================================")

print("Final shape:", clean_df.shape)

print("\nRoBERTa sentiment distribution:")
print(
    clean_df["roberta_sentiment"].value_counts()
)

print("\nSaved to:")
print(output_file)

print("\nPreview:")
print(clean_df.head())