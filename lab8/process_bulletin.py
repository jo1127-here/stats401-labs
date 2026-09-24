import os
import re
import fitz
import pandas as pd
import numpy as np

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
import umap.umap_ as umap


# ============================================================
# 1. PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PDF_PATH = os.path.join(
    BASE_DIR,
    "data",
    "ug_bulletin 2023-24.pdf"
)

DATA_DIR = os.path.join(BASE_DIR, "data")

PASSAGE_OUTPUT = os.path.join(
    DATA_DIR,
    "bulletin_passages.csv"
)

EMBEDDING_OUTPUT = os.path.join(
    DATA_DIR,
    "lab8_embedding_map.csv"
)

MATRIX_OUTPUT = os.path.join(
    DATA_DIR,
    "lab8_topic_section_matrix.csv"
)


# ============================================================
# 2. PDF → TEXT
# ============================================================

def clean_text(text):
    """
    Clean PDF extracted text.
    """

    # Remove repeated whitespace
    text = re.sub(r"\s+", " ", text)

    # Remove spaces before punctuation
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)

    return text.strip()


def extract_pdf():

    print("=" * 60)
    print("STEP 1: Extracting PDF")
    print("=" * 60)

    if not os.path.exists(PDF_PATH):
        raise FileNotFoundError(
            f"PDF not found:\n{PDF_PATH}"
        )

    doc = fitz.open(PDF_PATH)

    print(f"PDF pages: {len(doc)}")

    rows = []

    passage_counter = 1

    for page_number, page in enumerate(doc, start=1):

        text = page.get_text("text")

        if not text.strip():
            continue

        # Split into paragraphs based on blank lines
        paragraphs = re.split(
            r"\n\s*\n",
            text
        )

        for paragraph in paragraphs:

            paragraph = clean_text(paragraph)

            if len(paragraph) < 30:
                continue

            # Remove extremely short page artifacts
            if paragraph.isdigit():
                continue

            rows.append({
                "passage_id": f"p{passage_counter:05d}",
                "chapter": "",
                "section": "",
                "subsection": "",
                "page": page_number,
                "text": paragraph
            })

            passage_counter += 1

    df = pd.DataFrame(rows)

    # Remove duplicate text
    df = df.drop_duplicates(
        subset=["text"]
    ).reset_index(drop=True)

    # Re-number passage IDs
    df["passage_id"] = [
        f"p{i:05d}"
        for i in range(1, len(df) + 1)
    ]

    df.to_csv(
        PASSAGE_OUTPUT,
        index=False,
        encoding="utf-8"
    )

    print(f"Passages created: {len(df)}")
    print(f"Saved to: {PASSAGE_OUTPUT}")

    return df


# ============================================================
# 3. BASIC TEXT CLEANING
# ============================================================

def clean_dataframe(df):

    print("=" * 60)
    print("STEP 2: Cleaning corpus")
    print("=" * 60)

    df = df.copy()

    df["text"] = (
        df["text"]
        .fillna("")
        .astype(str)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

    # Remove empty passages
    df = df[
        df["text"].str.len() > 30
    ].copy()

    # Remove duplicates
    df = df.drop_duplicates(
        subset=["text"]
    )

    # Word count
    df["word_count"] = (
        df["text"]
        .str.split()
        .str.len()
    )

    df = df.reset_index(drop=True)

    print(f"Clean passages: {len(df)}")

    print("\nWord count:")
    print(df["word_count"].describe())

    return df


# ============================================================
# 4. GENERATE EMBEDDINGS
# ============================================================

def generate_embeddings(df):

    print("=" * 60)
    print("STEP 3: Generating semantic embeddings")
    print("=" * 60)

    model_name = "all-MiniLM-L6-v2"

    print(f"Model: {model_name}")

    model = SentenceTransformer(
        model_name
    )

    texts = df["text"].tolist()

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True
    )

    embeddings = np.asarray(
        embeddings
    )

    print(
        f"Embedding shape: {embeddings.shape}"
    )

    return embeddings


# ============================================================
# 5. UMAP
# ============================================================

def run_umap(embeddings):

    print("=" * 60)
    print("STEP 4: Running UMAP")
    print("=" * 60)

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=401
    )

    coordinates = reducer.fit_transform(
        embeddings
    )

    print(
        f"UMAP shape: {coordinates.shape}"
    )

    return coordinates


# ============================================================
# 6. KMEANS CLUSTERING
# ============================================================

def run_clustering(embeddings):

    print("=" * 60)
    print("STEP 5: Clustering")
    print("=" * 60)

    N_CLUSTERS = 8

    kmeans = KMeans(
        n_clusters=N_CLUSTERS,
        random_state=401,
        n_init="auto"
    )

    labels = kmeans.fit_predict(
        embeddings
    )

    print(
        "Cluster counts:"
    )

    unique, counts = np.unique(
        labels,
        return_counts=True
    )

    for cluster, count in zip(
        unique,
        counts
    ):
        print(
            f"Cluster {cluster}: {count}"
        )

    return labels


# ============================================================
# 7. TEMPORARY TOPIC LABELS
# ============================================================

def assign_topic_names(df):

    """
    These are temporary labels.

    You should inspect representative passages
    and revise these labels based on the actual corpus.
    """

    topic_names = {
        0: "Topic 0",
        1: "Topic 1",
        2: "Topic 2",
        3: "Topic 3",
        4: "Topic 4",
        5: "Topic 5",
        6: "Topic 6",
        7: "Topic 7"
    }

    df["cluster_name"] = (
        df["cluster"]
        .map(topic_names)
    )

    return df


# ============================================================
# 8. SAVE EMBEDDING DATA
# ============================================================

def save_embedding_data(
    df,
    coordinates
):

    print("=" * 60)
    print("STEP 6: Saving embedding map")
    print("=" * 60)

    df = df.copy()

    df["x"] = coordinates[:, 0]
    df["y"] = coordinates[:, 1]

    columns = [
        "passage_id",
        "chapter",
        "section",
        "subsection",
        "page",
        "text",
        "word_count",
        "cluster",
        "cluster_name",
        "x",
        "y"
    ]

    df[columns].to_csv(
        EMBEDDING_OUTPUT,
        index=False,
        encoding="utf-8"
    )

    print(
        f"Saved to: {EMBEDDING_OUTPUT}"
    )

    return df


# ============================================================
# 9. TOPIC × SECTION MATRIX
# ============================================================

def create_matrix(df):

    print("=" * 60)
    print("STEP 7: Creating Topic × Section matrix")
    print("=" * 60)

    # Since automatic section extraction from arbitrary PDF
    # layouts can be unreliable, use page groups temporarily
    # if section metadata is unavailable.

    if (
        df["section"]
        .fillna("")
        .str.strip()
        .eq("")
        .all()
    ):

        print(
            "No section metadata detected."
        )

        # Use page ranges as temporary formal sections
        df["section"] = (
            "Pages "
            + (
                ((df["page"] - 1) // 20) * 20 + 1
            ).astype(str)
            + "-"
            + (
                ((df["page"] - 1) // 20) * 20 + 20
            ).astype(str)
        )

    matrix_df = (
        df
        .groupby(
            [
                "section",
                "cluster_name"
            ]
        )
        .size()
        .reset_index(
            name="count"
        )
    )

    matrix_df.to_csv(
        MATRIX_OUTPUT,
        index=False,
        encoding="utf-8"
    )

    print(
        f"Saved to: {MATRIX_OUTPUT}"
    )

    return matrix_df


# ============================================================
# 10. SHOW REPRESENTATIVE PASSAGES
# ============================================================

def inspect_clusters(df):

    print("=" * 60)
    print("STEP 8: Representative passages")
    print("=" * 60)

    for cluster in sorted(
        df["cluster"].unique()
    ):

        print("\n")
        print("=" * 50)
        print(
            f"CLUSTER {cluster} "
            f"({df.loc[df['cluster'] == cluster, 'cluster_name'].iloc[0]})"
        )
        print("=" * 50)

        subset = df[
            df["cluster"] == cluster
        ]

        for text in subset[
            "text"
        ].head(5):

            print(
                "\n-",
                text[:500]
            )


# ============================================================
# 11. MAIN
# ============================================================

def main():

    # PDF → passages
    df = extract_pdf()

    # Clean
    df = clean_dataframe(df)

    # Embeddings
    embeddings = generate_embeddings(df)

    # UMAP
    coordinates = run_umap(
        embeddings
    )

    # Clustering
    clusters = run_clustering(
        embeddings
    )

    df["cluster"] = clusters

    # Topic names
    df = assign_topic_names(
        df
    )

    # Save map data
    df = save_embedding_data(
        df,
        coordinates
    )

    # Matrix
    create_matrix(df)

    # Inspect clusters
    inspect_clusters(df)

    print("\n")
    print("=" * 60)
    print("DONE!")
    print("=" * 60)

    print(
        "\nGenerated files:"
    )

    print(
        "1.",
        PASSAGE_OUTPUT
    )

    print(
        "2.",
        EMBEDDING_OUTPUT
    )

    print(
        "3.",
        MATRIX_OUTPUT
    )


if __name__ == "__main__":
    main()
