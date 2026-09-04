import pandas as pd
import re
from transformers import pipeline


# =========================
# 1. Load raw data
# =========================

df = pd.read_csv("../data/lab4_raw_tweets.csv")

print("Original shape:", df.shape)
print(df.head())
print(df.info())


# =========================
# 2. Missing values
# =========================

print("\nMissing values:")
print(df.isna().sum())

# Tweet text is necessary for sentiment analysis
df = df.dropna(subset=["tweet_text"])

# Missing retweets -> 0
df["retweets"] = df["retweets"].fillna(0)


# =========================
# 3. Remove duplicates
# =========================

print("\nDuplicate rows:", df.duplicated().sum())

df = df.drop_duplicates()

# Remove duplicate tweet IDs
if "tweet_id" in df.columns:
    df = df.drop_duplicates(
        subset=["tweet_id"],
        keep="first"
    )


# =========================
# 4. Clean numeric columns
# =========================

df["likes"] = (
    df["likes"]
    .astype(str)
    .str.replace(",", "", regex=False)
)

df["likes"] = pd.to_numeric(
    df["likes"],
    errors="coerce"
)

df["retweets"] = pd.to_numeric(
    df["retweets"],
    errors="coerce"
)

# Negative retweets are invalid
df.loc[df["retweets"] < 0, "retweets"] = pd.NA

# Fill missing numeric values
df["likes"] = df["likes"].fillna(
    df["likes"].median()
)

df["retweets"] = df["retweets"].fillna(0)


# =========================
# 5. Parse dates
# =========================

df["created_at"] = pd.to_datetime(
    df["created_at"],
    errors="coerce",
    format="mixed"
)

# Remove rows without valid dates
df = df.dropna(subset=["created_at"])

df["date"] = df["created_at"].dt.date
df["hour"] = df["created_at"].dt.hour
df["weekday"] = df["created_at"].dt.day_name()


# =========================
# 6. Clean platform
# =========================

df["platform"] = (
    df["platform"]
    .astype("string")
    .str.strip()
    .str.lower()
)

platform_map = {
    "web": "Web",
    "mobile": "Mobile",
    "ios": "iOS",
    "android": "Android"
}

df["platform"] = df["platform"].map(platform_map)


# =========================
# 7. Clean username
# =========================

df["username"] = (
    df["username"]
    .astype("string")
    .str.strip()
    .str.replace(r"^@", "", regex=True)
    .str.lower()
)


# =========================
# 8. Clean tweet text
# =========================

df["tweet_text"] = (
    df["tweet_text"]
    .astype("string")
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

# Keep original text
df["tweet_text_raw"] = df["tweet_text"]


# =========================
# 9. Prepare text for RoBERTa
# =========================

def prepare_for_roberta(text):

    text = str(text)

    # Replace usernames
    text = re.sub(
        r"@\w+",
        "@user",
        text
    )

    # Replace URLs
    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )

    return text.strip()


df["sentiment_text"] = (
    df["tweet_text_raw"]
    .fillna("")
    .apply(prepare_for_roberta)
)


# =========================
# 10. RoBERTa sentiment model
# =========================

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    top_k=None
)

print("\nRunning sentiment analysis...")

results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)


# =========================
# 11. Convert sentiment scores
# =========================

def scores_to_dict(scores):

    return {
        item["label"].lower(): item["score"]
        for item in scores
    }


score_dicts = [
    scores_to_dict(scores)
    for scores in results
]


df["sentiment_negative"] = [
    scores.get("negative", 0)
    for scores in score_dicts
]

df["sentiment_neutral"] = [
    scores.get("neutral", 0)
    for scores in score_dicts
]

df["sentiment_positive"] = [
    scores.get("positive", 0)
    for scores in score_dicts
]


# =========================
# 12. Predicted sentiment
# =========================

def predicted_label(scores):

    return max(
        scores,
        key=scores.get
    ).capitalize()


df["sentiment"] = [
    predicted_label(scores)
    for scores in score_dicts
]


# =========================
# 13. Numeric sentiment score
# =========================

df["sentiment_score"] = (
    df["sentiment_positive"]
    - df["sentiment_negative"]
)


# =========================
# 14. Create visualization dataset
# =========================

vis_df = df[
    [
        "tweet_id",
        "created_at",
        "date",
        "hour",
        "weekday",
        "username",
        "platform",
        "tweet_text_raw",
        "likes",
        "retweets",
        "sentiment_negative",
        "sentiment_neutral",
        "sentiment_positive",
        "sentiment_score",
        "sentiment"
    ]
].copy()


# =========================
# 15. Save cleaned dataset
# =========================

vis_df.to_csv(
    "../data/lab4_clean_tweets.csv",
    index=False
)


# =========================
# 16. Create aggregated data
# =========================

sentiment_counts = (
    vis_df["sentiment"]
    .value_counts()
    .rename_axis("sentiment")
    .reset_index(name="count")
)

sentiment_counts.to_csv(
    "../data/sentiment_counts.csv",
    index=False
)


# Sentiment by platform
sentiment_platform = (
    vis_df
    .groupby(
        ["platform", "sentiment"]
    )
    .size()
    .reset_index(name="count")
)

sentiment_platform.to_csv(
    "../data/sentiment_by_platform.csv",
    index=False
)


# Average sentiment by weekday
sentiment_time = (
    vis_df
    .groupby("weekday")["sentiment_score"]
    .mean()
    .reset_index()
)

sentiment_time.to_csv(
    "../data/sentiment_by_weekday.csv",
    index=False
)


print("\nFinal dataset:")
print(vis_df.head())

print("\nFinal shape:")
print(vis_df.shape)

print("\nSentiment counts:")
print(vis_df["sentiment"].value_counts())

print("\nFinished!")
