#!/usr/bin/env python3

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

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

PDF_PATH = os.path.join(
    BASE_DIR,
    "data",
    "ug_bulletin 2023-24.pdf"
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

PASSAGE_OUTPUT = os.path.join(
    DATA_DIR,
    "bulletin_course_descriptions.csv"
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
# 2. BASIC CLEANING
# ============================================================

def clean_text(text):
    """
    Clean PDF-extracted text.
    """

    text = text.replace("\xa0", " ")

    # Remove repeated whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    )

    # Remove spaces before punctuation
    text = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        text
    )

    return text.strip()


# ============================================================
# 3. EXTRACT COURSE DESCRIPTIONS
# ============================================================

def extract_course_descriptions():

    print("=" * 60)
    print("STEP 1: Extracting Course Descriptions")
    print("=" * 60)

    if not os.path.exists(PDF_PATH):
        raise FileNotFoundError(
            f"PDF not found:\n{PDF_PATH}"
        )

    doc = fitz.open(
        PDF_PATH
    )

    print(
        f"PDF pages: {len(doc)}"
    )

    # --------------------------------------------------------
    # Extract all page text
    # --------------------------------------------------------

    pages = []

    for page_number, page in enumerate(
        doc,
        start=1
    ):

        text = page.get_text(
            "text"
        )

        if text.strip():

            pages.append(
                {
                    "page": page_number,
                    "text": text
                }
            )

    # --------------------------------------------------------
    # Find Course Descriptions section
    # --------------------------------------------------------

    start_page = None

    for item in pages:

        if re.search(
            r"\bCourse Descriptions\b",
            item["text"],
            flags=re.IGNORECASE
        ):

            start_page = item["page"]

            break

    if start_page is None:

        raise RuntimeError(
            "Could not find 'Course Descriptions' in the PDF."
        )

    print(
        f"Course Descriptions starts on page: {start_page}"
    )

    # --------------------------------------------------------
    # Combine text starting from Course Descriptions
    # --------------------------------------------------------

    corpus_parts = []

    for item in pages:

        if item["page"] >= start_page:

            corpus_parts.append(
                f"\nPAGE_{item['page']}\n"
                + item["text"]
            )

    corpus = "\n".join(
        corpus_parts
    )

    # --------------------------------------------------------
    # Stop when the course catalog section clearly ends
    #
    # This is intentionally conservative.
    # --------------------------------------------------------

    stop_patterns = [
        r"\n\s*Academic Policies\s*\n",
        r"\n\s*Academic Regulations\s*\n",
        r"\n\s*Faculty\s*\n",
        r"\n\s*Appendix\s*\n"
    ]

    for pattern in stop_patterns:

        match = re.search(
            pattern,
            corpus,
            flags=re.IGNORECASE
        )

        if match:

            corpus = corpus[
                :match.start()
            ]

            break

    # --------------------------------------------------------
    # Course heading pattern
    #
    # Examples:
    #
    # ARTS 21 General Art, Studio (4 credits)
    #
    # ARTS 105 / PHYS 105
    # The Science of Traditional Asian Music (4 credits)
    #
    # ARTS 106/HIST 106 European Art History 1 (4 credits)
    # --------------------------------------------------------

    course_pattern = re.compile(
        r"""
        (?P<code>
            [A-Z]{2,8}
            \s*\d{1,4}
            (?:
                \s*/\s*
                [A-Z]{2,8}
                \s*\d{1,4}
            )*
        )
        \s*
        (?P<title>.*?)
        \s*
        \(
            (?P<credits>\d+(?:\.\d+)?)
            \s*credits?
        \)
        """,
        flags=re.IGNORECASE
        | re.VERBOSE
        | re.DOTALL
    )

    matches = list(
        course_pattern.finditer(
            corpus
        )
    )

    print(
        f"Course headings detected: {len(matches)}"
    )

    rows = []

    for i, match in enumerate(
        matches
    ):

        course_code = clean_text(
            match.group("code")
        )

        course_title = clean_text(
            match.group("title")
        )

        credits = match.group(
            "credits"
        )

        # ----------------------------------------------------
        # Description starts immediately after course heading
        # ----------------------------------------------------

        description_start = match.end()

        if i + 1 < len(matches):

            description_end = matches[
                i + 1
            ].start()

        else:

            description_end = len(
                corpus
            )

        description = corpus[
            description_start:
            description_end
        ]

        # ----------------------------------------------------
        # Remove page markers
        # ----------------------------------------------------

        description = re.sub(
            r"PAGE_\d+",
            " ",
            description
        )

        description = clean_text(
            description
        )

        # ----------------------------------------------------
        # Remove obvious repeated header/footer artifacts
        # ----------------------------------------------------

        description = re.sub(
            r"\bCourse Descriptions\b",
            " ",
            description,
            flags=re.IGNORECASE
        )

        description = clean_text(
            description
        )

        # ----------------------------------------------------
        # Skip invalid entries
        # ----------------------------------------------------

        if len(description) < 30:

            continue

        # ----------------------------------------------------
        # Subject
        #
        # For:
        # ARTS 105 / PHYS 105
        #
        # primary subject = ARTS
        # ----------------------------------------------------

        subject_match = re.match(
            r"([A-Z]{2,8})",
            course_code
        )

        if subject_match:

            subject = subject_match.group(
                1
            )

        else:

            subject = "UNKNOWN"

        # ----------------------------------------------------
        # Passage text
        #
        # This is what will be embedded.
        # ----------------------------------------------------

        passage_text = (
            f"{course_title}. "
            f"{description}"
        )

        rows.append(
            {
                "passage_id":
                    f"course_{len(rows) + 1:04d}",

                "chapter":
                    "Course Catalog",

                "section":
                    "Course Descriptions",

                "subsection":
                    subject,

                "subject":
                    subject,

                "course_code":
                    course_code,

                "course_title":
                    course_title,

                "credits":
                    float(credits),

                "page":
                    None,

                "text":
                    passage_text
            }
        )

    df = pd.DataFrame(
        rows
    )

    # --------------------------------------------------------
    # Remove duplicate courses
    # --------------------------------------------------------

    df = df.drop_duplicates(
        subset=[
            "course_code",
            "course_title",
            "text"
        ]
    ).reset_index(
        drop=True
    )

    # Re-number IDs
    df["passage_id"] = [
        f"course_{i:04d}"
        for i in range(
            1,
            len(df) + 1
        )
    ]

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    df.to_csv(
        PASSAGE_OUTPUT,
        index=False,
        encoding="utf-8"
    )

    print(
        f"Courses extracted: {len(df)}"
    )

    print(
        f"Subjects: {df['subject'].nunique()}"
    )

    print(
        f"Saved to: {PASSAGE_OUTPUT}"
    )

    return df


# ============================================================
# 4. CLEAN CORPUS
# ============================================================

def clean_dataframe(df):

    print("=" * 60)
    print("STEP 2: Cleaning corpus")
    print("=" * 60)

    df = df.copy()

    # --------------------------------------------------------
    # Clean text
    # --------------------------------------------------------

    df["text"] = (
        df["text"]
        .fillna("")
        .astype(str)
        .str.replace(
            r"\s+",
            " ",
            regex=True
        )
        .str.strip()
    )

    # --------------------------------------------------------
    # Remove empty descriptions
    # --------------------------------------------------------

    df = df[
        df["text"].str.len() > 30
    ].copy()

    # --------------------------------------------------------
    # Remove duplicates
    # --------------------------------------------------------

    df = df.drop_duplicates(
        subset=["text"]
    )

    # --------------------------------------------------------
    # Word count
    # --------------------------------------------------------

    df["word_count"] = (
        df["text"]
        .str.split()
        .str.len()
    )

    # --------------------------------------------------------
    # Character count
    # --------------------------------------------------------

    df["char_count"] = (
        df["text"]
        .str.len()
    )

    df = df.reset_index(
        drop=True
    )

    print(
        f"Clean courses: {len(df)}"
    )

    print("\nWord count summary:")

    print(
        df["word_count"].describe()
    )

    print("\nCourses by subject:")

    print(
        df["subject"]
        .value_counts()
        .head(20)
    )

    return df


# ============================================================
# 5. GENERATE EMBEDDINGS
# ============================================================

def generate_embeddings(df):

    print("=" * 60)
    print("STEP 3: Generating semantic embeddings")
    print("=" * 60)

    model_name = (
        "all-MiniLM-L6-v2"
    )

    print(
        f"Model: {model_name}"
    )

    model = SentenceTransformer(
        model_name
    )

    texts = df[
        "text"
    ].tolist()

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
# 6. UMAP
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
# 7. KMEANS CLUSTERING
# ============================================================

def run_clustering(embeddings):

    print("=" * 60)
    print("STEP 5: Clustering")
    print("=" * 60)

    # --------------------------------------------------------
    # Number of semantic topics
    # --------------------------------------------------------

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
# 8. TOPIC LABELS
# ============================================================

def assign_topic_names(df):

    print("=" * 60)
    print("STEP 6: Assigning topic names")
    print("=" * 60)

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # These are initial labels.
    #
    # Run the script first, inspect the representative
    # courses, and then replace these with meaningful labels.
    # --------------------------------------------------------

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
# 9. SAVE EMBEDDING MAP
# ============================================================

def save_embedding_data(
    df,
    coordinates
):

    print("=" * 60)
    print("STEP 7: Saving embedding map")
    print("=" * 60)

    df = df.copy()

    df["x"] = coordinates[
        :, 0
    ]

    df["y"] = coordinates[
        :, 1
    ]

    columns = [

        "passage_id",

        "chapter",

        "section",

        "subsection",

        "subject",

        "course_code",

        "course_title",

        "credits",

        "page",

        "text",

        "word_count",

        "char_count",

        "cluster",

        "cluster_name",

        "x",

        "y"
    ]

    df[
        columns
    ].to_csv(
        EMBEDDING_OUTPUT,
        index=False,
        encoding="utf-8"
    )

    print(
        f"Saved to: {EMBEDDING_OUTPUT}"
    )

    return df


# ============================================================
# 10. TOPIC × SUBJECT MATRIX
# ============================================================

def create_matrix(df):

    print("=" * 60)
    print("STEP 8: Creating Topic × Subject matrix")
    print("=" * 60)

    # --------------------------------------------------------
    # Since every passage belongs to the Course Descriptions
    # section, using "section" directly would create only
    # one row.
    #
    # Therefore, subsection/subject is used as the formal
    # category for the matrix.
    # --------------------------------------------------------

    matrix_df = (
        df
        .groupby(
            [
                "subject",
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
# 11. CORPUS SUMMARY
# ============================================================

def print_corpus_summary(df):

    print("=" * 60)
    print("CORPUS SUMMARY")
    print("=" * 60)

    print(
        f"Number of courses: {len(df)}"
    )

    print(
        f"Number of subjects: "
        f"{df['subject'].nunique()}"
    )

    print(
        f"Average words per course: "
        f"{df['word_count'].mean():.2f}"
    )

    print(
        f"Median words per course: "
        f"{df['word_count'].median():.0f}"
    )

    print(
        "\nTop subjects:"
    )

    print(
        df["subject"]
        .value_counts()
        .head(15)
    )


# ============================================================
# 12. REPRESENTATIVE COURSES
# ============================================================

def inspect_clusters(df):

    print("=" * 60)
    print("REPRESENTATIVE COURSES BY TOPIC")
    print("=" * 60)

    for cluster in sorted(
        df["cluster"].unique()
    ):

        subset = df[
            df["cluster"] == cluster
        ]

        topic_name = (
            subset[
                "cluster_name"
            ].iloc[0]
        )

        print("\n")
        print(
            "=" * 60
        )

        print(
            f"CLUSTER {cluster}: "
            f"{topic_name}"
        )

        print(
            "=" * 60
        )

        for _, row in subset[
            [
                "course_code",
                "course_title",
                "subject",
                "text"
            ]
        ].head(5).iterrows():

            print(
                f"\n{row['course_code']} "
                f"{row['course_title']}"
            )

            print(
                row["text"][:500]
            )


# ============================================================
# 13. MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Course descriptions → passages
    # --------------------------------------------------------

    df = extract_course_descriptions()

    # --------------------------------------------------------
    # Cleaning
    # --------------------------------------------------------

    df = clean_dataframe(
        df
    )

    # --------------------------------------------------------
    # Corpus summary
    # --------------------------------------------------------

    print_corpus_summary(
        df
    )

    # --------------------------------------------------------
    # Embeddings
    # --------------------------------------------------------

    embeddings = generate_embeddings(
        df
    )

    # --------------------------------------------------------
    # UMAP
    # --------------------------------------------------------

    coordinates = run_umap(
        embeddings
    )

    # --------------------------------------------------------
    # Clustering
    # --------------------------------------------------------

    clusters = run_clustering(
        embeddings
    )

    df["cluster"] = clusters

    # --------------------------------------------------------
    # Topic names
    # --------------------------------------------------------

    df = assign_topic_names(
        df
    )

    # --------------------------------------------------------
    # Save embedding data
    # --------------------------------------------------------

    df = save_embedding_data(
        df,
        coordinates
    )

    # --------------------------------------------------------
    # Topic × Subject matrix
    # --------------------------------------------------------

    create_matrix(
        df
    )

    # --------------------------------------------------------
    # Representative courses
    # --------------------------------------------------------

    inspect_clusters(
        df
    )

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


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()
