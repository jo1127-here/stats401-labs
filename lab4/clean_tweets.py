import pandas as pd
import re
from transformers import pipeline

# ==========================================
# 1. Load dirty data
# ==========================================

input_file = "../data/lab4_dirty_tweets.csv"

df = pd.read_csv(
    input_file,
    encoding="latin-1"
)

print("Original shape:", df.shape)
print(df.head())


# ==========================================
# 2. Check missing values
# ==========================================

print("\nMissing values:")
print(df.isnull().sum())


# ==========================================
# 3. Remove missing tweets
# ==========================================

df = df.dropna(subset=["text"])


# ==========================================
# 4. Remove duplicate tweets
# ==========================================

df = df.drop_duplicates(subset=["tweet_id"])


# ==========================================
# 5. Clean tweet text
# ==========================================

df["text"] = (
    df["text"]
    .astype(str)
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

# Remove empty tweets
df = df[df["text"].str.len() > 0]


# ==========================================
# 6. Convert date
# ==========================================

df["date"] = pd.to_datetime(
    df["date"],
    errors="coerce"
)


# Remove invalid dates
df = df.dropna(subset=["date"])


# ==========================================
# 7. Convert original sentiment labels
# ==========================================

label_map = {
    0: "Negative",
    2: "Neutral",
    4: "Positive"
}

df["original_sentiment"] = df["target"].map(label_map)


# ==========================================
# 8. Create additional tweet attributes
# ==========================================

# Number of characters
df["tweet_length"] = df["text"].str.len()

# Number of words
df["word_count"] = df["text"].str.split().str.len()


# ==========================================
# 9. Prepare text for RoBERTa
# ==========================================

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


# ==========================================
# 10. Load RoBERTa
# ==========================================

print("\nLoading RoBERTa model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest"
)


# ==========================================
# 11. Run sentiment analysis
# ==========================================

print("Running RoBERTa sentiment analysis...")

results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)


# ==========================================
# 12. Extract sentiment scores
# ==========================================

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


df["roberta_negative"] = negative_scores
df["roberta_neutral"] = neutral_scores
df["roberta_positive"] = positive_scores

df["roberta_sentiment"] = predicted_sentiments


# ==========================================
# 13. Create sentiment score
# ==========================================

df["sentiment_score"] = (
    df["roberta_positive"]
    - df["roberta_negative"]
)


# ==========================================
# 14. Select final columns
# ==========================================

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


# ==========================================
# 15. Save clean CSV
# ==========================================

output_file = "../data/lab4_clean_tweets.csv"

clean_df.to_csv(
    output_file,
    index=False
)

print("\n================================")
print("Cleaning completed!")
print("================================")

print("Final shape:", clean_df.shape)

print("\nRoBERTa sentiment distribution:")
print(
    clean_df["roberta_sentiment"].value_counts()
)

print("\nSaved to:")
print(output_file)    .astype(str)
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

# Remove empty tweets
df = df[df["text"].str.len() > 0]


# ============================================================
# 3. Convert date
# ============================================================

df["date"] = pd.to_datetime(
    df["date"],
    errors="coerce"
)

# Remove rows with invalid dates
df = df.dropna(subset=["date"])


# ============================================================
# 4. Convert original sentiment labels
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
# 5. Sample 10,000 tweets
# ============================================================

# Keep the dataset balanced by original sentiment label
sample_n = min(5000, df["target"].value_counts().min())

df = (
    df.groupby("target", group_keys=False)
      .sample(n=sample_n, random_state=42)
      .reset_index(drop=True)
)

print("Sampled shape:", df.shape)


# ============================================================
# 6. Create tweet-level attributes
# ============================================================

# Tweet length
df["tweet_length"] = df["text"].str.len()

# Number of words
df["word_count"] = df["text"].str.split().str.len()


# ============================================================
# 7. Prepare text for RoBERTa
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


# ============================================================
# 8. RoBERTa sentiment analysis
# ============================================================

print("Loading RoBERTa model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest"
)

print("Running sentiment analysis...")


results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)


# ============================================================
# 9. Extract RoBERTa sentiment scores
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

    negative_scores.append(scores.get("negative", 0))
    neutral_scores.append(scores.get("neutral", 0))
    positive_scores.append(scores.get("positive", 0))

    predicted_sentiments.append(
        max(scores, key=scores.get).capitalize()
    )


df["roberta_negative"] = negative_scores
df["roberta_neutral"] = neutral_scores
df["roberta_positive"] = positive_scores

df["roberta_sentiment"] = predicted_sentiments


# ============================================================
# 10. Create a continuous sentiment score
# ============================================================

# Positive score - Negative score
#
# close to -1 → negative
# close to  0 → neutral
# close to +1 → positive

df["sentiment_score"] = (
    df["roberta_positive"]
    - df["roberta_negative"]
)


# ============================================================
# 11. Keep only useful columns
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
# 12. Save cleaned dataset
# ============================================================

output_file = "../data/lab4_clean_tweets.csv"

clean_df.to_csv(
    output_file,
    index=False
)

print("\nCleaning completed!")
print("Final shape:", clean_df.shape)
print("Saved to:", output_file)

print("\nSentiment distribution:")
print(clean_df["roberta_sentiment"].value_counts())

print("\nPreview:")
print(clean_df.head())
