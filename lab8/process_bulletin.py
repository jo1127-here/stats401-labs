from __future__ import annotations

import re
from pathlib import Path

import fitz
import numpy as np
import pandas as pd
import umap

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parent.parent

PDF_PATH = ROOT / "data" / "ug_bulletin 2023-24.pdf"

PASSAGE_OUTPUT = ROOT / "data" / "bulletin_passages.csv"
EMBEDDING_OUTPUT = ROOT / "data" / "lab8_embedding_map.csv"
MATRIX_OUTPUT = ROOT / "data" / "lab8_topic_section_matrix.csv"


# ============================================================
# SETTINGS
# ============================================================

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

N_CLUSTERS = 8

RANDOM_STATE = 401


# ============================================================
# BASIC TEXT CLEANING
# ============================================================

def normalize_unicode(text: str) -> str:
    """Normalize common PDF characters."""

    replacements = {
        "\xa0": " ",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\ufeff": "",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def clean_spaces(text: str) -> str:

    text = normalize_unicode(text)

    text = text.replace("\r", "\n")

    # Collapse spaces/tabs.
    text = re.sub(r"[ \t]+", " ", text)

    # Collapse excessive blank lines.
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ============================================================
# PDF ARTIFACT DETECTION
# ============================================================

def is_page_number(line: str) -> bool:

    line = line.strip()

    if not line:
        return False

    # Examples:
    # 267
    # Page 267
    # PAGE 267

    return bool(
        re.fullmatch(
            r"(?:page\s+)?\d+",
            line,
            flags=re.IGNORECASE,
        )
    )


def remove_inline_page_numbers(text: str) -> str:
    """
    Remove page numbers accidentally embedded in extracted text.

    Examples:

        "culture to date. 267 deeper appreciation"

    becomes:

        "culture to date. deeper appreciation"

    Also handles:

        "globalization of culture 268 cultural products"

    """

    # Page numbers appearing immediately after punctuation
    # and before another word.

    text = re.sub(
        r"(?<=[.!?])\s+\d{1,4}\s+(?=[A-Za-z])",
        " ",
        text,
    )

    # Page number between words.
    # We only target 2-3 digit numbers to avoid deleting
    # legitimate numbers such as course years.
    text = re.sub(
        r"(?<=[a-zA-Z])\s+\d{2,3}\s+(?=[a-zA-Z])",
        " ",
        text,
    )

    return text


def is_header_footer(line: str) -> bool:

    s = line.strip().lower()

    if not s:
        return True

    if is_page_number(s):
        return True

    exact_headers = {
        "duke kunshan university",
        "undergraduate instruction bulletin",
        "undergraduate bulletin",
    }

    if s in exact_headers:
        return True

    return False


# ============================================================
# FIX PDF WORD JOINING
# ============================================================

def fix_common_pdf_joins(text: str) -> str:
    """
    Fix words that became joined during PDF extraction.

    This is deliberately conservative.

    Examples:

        toacoustics
        becomemeaningful
        historicalbackground
        artand
        withthe
        ofAmerican

    """

    # --------------------------------------------------------
    # General English word-boundary repairs.
    #
    # We only repair a selected set of highly common joins.
    # --------------------------------------------------------

    replacements = [
        (r"\btoacoustics\b", "to acoustics"),
        (r"\btoart\b", "to art"),
        (r"\btoan\b", "to an"),
        (r"\btoapply\b", "to apply"),
        (r"\btoapproach\b", "to approach"),
        (r"\btoexplore\b", "to explore"),
        (r"\btointerpret\b", "to interpret"),
        (r"\btoidentify\b", "to identify"),
        (r"\btounderstand\b", "to understand"),
        (r"\touse\b", "to use"),

        (r"\bbecomemeaningful\b", "become meaningful"),
        (r"\bbecomesignificant\b", "become significant"),
        (r"\bbecomeaware\b", "become aware"),
        (r"\bbecomeordinary\b", "become ordinary"),

        (r"\bhistoricalbackground\b", "historical background"),
        (r"\bhistoricalcontext\b", "historical context"),
        (r"\bhistoricaltrajectory\b", "historical trajectory"),

        (r"\bwiththe\b", "with the"),
        (r"\bwitha\b", "with a"),
        (r"\bwithan\b", "with an"),
        (r"\bwiththis\b", "with this"),
        (r"\bwiththeir\b", "with their"),

        (r"\binthe\b", "in the"),
        (r"\bintheir\b", "in their"),
        (r"\bintroductionto\b", "introduction to"),

        (r"\bfromthe\b", "from the"),
        (r"\bfroma\b", "from a"),
        (r"\bfroman\b", "from an"),

        (r"\bofthe\b", "of the"),
        (r"\bofthis\b", "of this"),
        (r"\bofAmerican\b", "of American"),
        (r"\bofChinese\b", "of Chinese"),
        (r"\bofEast\b", "of East"),

        (r"\bandthe\b", "and the"),
        (r"\bandis\b", "and is"),
        (r"\bandstudents\b", "and students"),
        (r"\bandfocuses\b", "and focuses"),

        (r"\binthe\b", "in the"),
        (r"\bonlyif\b", "only if"),
        (r"\bforstudents\b", "for students"),
        (r"\bforcourse\b", "for course"),

        (r"\bmorethan\b", "more than"),
        (r"\bsuchas\b", "such as"),
        (r"\bparticularattention\b", "particular attention"),
        (r"\bspecialattention\b", "special attention"),
        (r"\bpartofthe\b", "part of the"),
    ]

    for pattern, replacement in replacements:

        text = re.sub(
            pattern,
            replacement,
            text,
            flags=re.IGNORECASE,
        )

    return text


# ============================================================
# LINE RECONSTRUCTION
# ============================================================

def join_lines(lines: list[str]) -> str:
    """
    Join physical PDF lines into normal prose.

    Hyphenated line breaks are repaired.
    """

    result = ""

    for raw in lines:

        line = raw.strip()

        if not line:
            continue

        if not result:
            result = line
            continue

        # Word broken at line boundary:
        #
        # comprehen-
        # sive
        #
        # → comprehensive

        if result.endswith("-") and line:

            # Only remove hyphen when the next word looks
            # like a continuation.
            if line[0].islower():

                result = (
                    result[:-1]
                    + line
                )

                continue

        result += " " + line

    result = clean_spaces(result)

    result = remove_inline_page_numbers(result)

    result = fix_common_pdf_joins(result)

    result = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        result,
    )

    return result.strip()


# ============================================================
# COURSE HEADER
# ============================================================

COURSE_CODE_RE = re.compile(
    r"\b([A-Z]{2,8})\s*([0-9]{3,4}[A-Z]?)\b"
)


def parse_course_header(text: str):

    text = clean_spaces(text)

    match = COURSE_CODE_RE.search(text)

    if not match:
        return None

    subject = match.group(1).strip()

    course_code = match.group(2).strip()

    remaining = text[match.end():].strip()

    # Find credits.
    credit_match = re.search(
        r"\(?\s*(\d+(?:\.\d+)?)\s+credits?\s*\)?",
        remaining,
        flags=re.IGNORECASE,
    )

    if credit_match:

        credits = float(
            credit_match.group(1)
        )

        title = remaining[
            :credit_match.start()
        ].strip(" ,.;:-")

        after_title = remaining[
            credit_match.end():
        ].strip()

    else:

        credits = np.nan

        title = remaining.strip(
            " ,.;:-"
        )

        after_title = ""

    # Reject obviously incorrect matches.
    if not title:
        return None

    if len(title) > 180:
        return None

    # A title should not look like a paragraph.
    if len(title.split()) > 30:
        return None

    return {
        "subject": subject,
        "course_code": course_code,
        "course_title": title,
        "credits": credits,
        "after_title": after_title,
    }


# ============================================================
# HEADING DETECTION
# ============================================================

def looks_like_heading(text: str) -> bool:

    s = text.strip()

    if not s:
        return False

    if len(s) > 120:
        return False

    lower = s.lower()

    if lower.startswith("chapter "):
        return True

    if lower.startswith("section "):
        return True

    if lower.startswith("part "):
        return True

    if re.match(
        r"^\d+(?:\.\d+)*\.?\s+[A-Z]",
        s,
    ):
        return True

    return False


# ============================================================
# PAGE EXTRACTION
# ============================================================

def extract_page_blocks(
    page_text: str,
) -> list[str]:

    page_text = clean_spaces(page_text)

    raw_blocks = re.split(
        r"\n\s*\n",
        page_text,
    )

    blocks = []

    for block in raw_blocks:

        raw_lines = block.split("\n")

        lines = []

        for line in raw_lines:

            line = line.strip()

            if not line:
                continue

            if is_header_footer(line):
                continue

            lines.append(line)

        if not lines:
            continue

        text = join_lines(lines)

        if not text:
            continue

        if is_page_number(text):
            continue

        blocks.append(text)

    return blocks


# ============================================================
# COURSE PASSAGE EXTRACTION
# ============================================================

def build_course_passage(
    blocks: list[str],
    start_index: int,
):

    first_block = blocks[start_index]

    course = parse_course_header(
        first_block
    )

    if course is None:
        return None, start_index + 1

    description_parts = []

    # --------------------------------------------------------
    # Text remaining after course title/credits
    # --------------------------------------------------------

    remainder = course.get(
        "after_title",
        "",
    ).strip()

    if remainder:
        description_parts.append(
            remainder
        )

    j = start_index + 1

    while j < len(blocks):

        block = blocks[j].strip()

        if not block:
            j += 1
            continue

        # Next course begins.
        if parse_course_header(block):
            break

        # New structural heading.
        if looks_like_heading(block):
            break

        # Some PDF pages contain standalone page numbers.
        if is_page_number(block):
            j += 1
            continue

        words = block.split()

        # Ignore tiny artifacts.
        if len(words) < 5:
            j += 1
            continue

        description_parts.append(block)

        j += 1

        # Avoid accidentally absorbing a whole section.
        current_words = len(
            " ".join(
                description_parts
            ).split()
        )

        if current_words > 300:
            break

    description = " ".join(
        description_parts
    )

    description = clean_spaces(
        description
    )

    description = remove_inline_page_numbers(
        description
    )

    description = fix_common_pdf_joins(
        description
    )

    # Clean spaces around punctuation.
    description = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        description,
    )

    return (
        {
            "course": course,
            "description": description,
        },
        j,
    )


# ============================================================
# MAIN PDF → DATAFRAME
# ============================================================

def extract_passages(
    pdf_path: Path,
) -> pd.DataFrame:

    pdf = fitz.open(pdf_path)

    records = []

    course_counter = 1

    current_chapter = "Unknown"
    current_section = "Unknown"
    current_subsection = "Unknown"

    # IMPORTANT:
    # start=1 means actual PDF page number.
    for page_index, page in enumerate(
        pdf,
        start=1,
    ):

        page_text = page.get_text(
            "text"
        )

        if not page_text.strip():
            continue

        blocks = extract_page_blocks(
            page_text
        )

        if not blocks:
            continue

        i = 0

        while i < len(blocks):

            block = blocks[i].strip()

            if not block:
                i += 1
                continue

            # ------------------------------------------------
            # Update hierarchy
            # ------------------------------------------------

            lower = block.lower()

            if lower.startswith(
                "chapter "
            ):
                current_chapter = block
                current_section = "Unknown"
                current_subsection = "Unknown"

                i += 1
                continue

            if lower.startswith(
                "section "
            ):
                current_section = block
                current_subsection = "Unknown"

                i += 1
                continue

            if looks_like_heading(block):
                current_subsection = block

                i += 1
                continue

            # ------------------------------------------------
            # Course
            # ------------------------------------------------

            course_result, next_i = (
                build_course_passage(
                    blocks,
                    i,
                )
            )

            if course_result is not None:

                course = course_result[
                    "course"
                ]

                description = (
                    course_result[
                        "description"
                    ]
                )

                # A valid course description should have
                # enough content to be meaningful.
                if len(
                    description.split()
                ) >= 8:

                    records.append(
                        {
                            "passage_id":
                                f"course_{course_counter:04d}",

                            "chapter":
                                current_chapter,

                            "section":
                                current_section,

                            "subsection":
                                current_subsection,

                            "subject":
                                course["subject"],

                            "course_code":
                                (
                                    course["subject"]
                                    + " "
                                    + course["course_code"]
                                ),

                            "course_title":
                                course["course_title"],

                            "credits":
                                course["credits"],

                            "page":
                                page_index,

                            "text":
                                description,
                        }
                    )

                    course_counter += 1

                i = next_i

                continue

            # ------------------------------------------------
            # Ordinary paragraph / policy block
            # ------------------------------------------------

            text = block

            text = remove_inline_page_numbers(
                text
            )

            text = fix_common_pdf_joins(
                text
            )

            text = clean_spaces(
                text
            )

            if len(
                text.split()
            ) < 8:

                i += 1
                continue

            # Skip table-of-contents artifacts.
            if re.search(
                r"\.{3,}\s*\d+$",
                text,
            ):
                i += 1
                continue

            records.append(
                {
                    "passage_id":
                        f"passage_{len(records)+1:04d}",

                    "chapter":
                        current_chapter,

                    "section":
                        current_section,

                    "subsection":
                        current_subsection,

                    "subject":
                        "Unknown",

                    "course_code":
                        "Unknown",

                    "course_title":
                        "Unknown",

                    "credits":
                        np.nan,

                    "page":
                        page_index,

                    "text":
                        text,
                }
            )

            i += 1

    pdf.close()

    return pd.DataFrame(
        records
    )


# ============================================================
# FINAL CORPUS CLEANING
# ============================================================

def clean_corpus(
    df: pd.DataFrame,
) -> pd.DataFrame:

    df = df.copy()

    df["text"] = (
        df["text"]
        .fillna("")
        .astype(str)
        .map(clean_spaces)
    )

    df["text"] = (
        df["text"]
        .map(remove_inline_page_numbers)
        .map(fix_common_pdf_joins)
        .map(clean_spaces)
    )

    # Remove duplicate passages.
    df = df.drop_duplicates(
        subset=["text"],
        keep="first",
    )

    # Remove very short passages.
    df = df[
        df["text"]
        .str.split()
        .str.len()
        >= 8
    ].copy()

    # Page must be numeric.
    df["page"] = pd.to_numeric(
        df["page"],
        errors="coerce",
    )

    df = df[
        df["page"].notna()
    ].copy()

    df["page"] = (
        df["page"]
        .astype(int)
    )

    # Never allow page 0.
    df = df[
        df["page"] > 0
    ].copy()

    df = df.reset_index(
        drop=True
    )

    # Reassign clean IDs.
    new_ids = []

    for i, row in df.iterrows():

        if row["course_code"] != "Unknown":
            new_ids.append(
                f"course_{i+1:04d}"
            )
        else:
            new_ids.append(
                f"passage_{i+1:04d}"
            )

    df["passage_id"] = new_ids

    # Word count.
    df["word_count"] = (
        df["text"]
        .str.split()
        .str.len()
    )

    # Character count.
    df["char_count"] = (
        df["text"]
        .str.len()
    )

    return df


# ============================================================
# TOPIC LABELS
# ============================================================

def generate_cluster_labels(
    df: pd.DataFrame,
) -> dict[int, str]:

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=5000,
        ngram_range=(1, 2),
        min_df=2,
    )

    matrix = vectorizer.fit_transform(
        df["text"].tolist()
    )

    terms = np.array(
        vectorizer.get_feature_names_out()
    )

    labels = {}

    for cluster in sorted(
        df["cluster"].unique()
    ):

        indices = np.where(
            df["cluster"].values
            == cluster
        )[0]

        scores = np.asarray(
            matrix[indices].mean(
                axis=0
            )
        ).ravel()

        top_indices = (
            scores.argsort()[-3:][::-1]
        )

        top_terms = [
            terms[i]
            for i in top_indices
            if scores[i] > 0
        ]

        if top_terms:

            labels[cluster] = (
                " / ".join(
                    term.title()
                    for term in top_terms
                )
            )

        else:

            labels[cluster] = (
                f"Topic {cluster}"
            )

    return labels


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("LAB 8 - DKU BULLETIN PROCESSING")
    print("=" * 70)

    print()
    print("PDF:")
    print(PDF_PATH)

    if not PDF_PATH.exists():

        raise FileNotFoundError(
            f"PDF not found: {PDF_PATH}"
        )

    # ========================================================
    # 1. PDF EXTRACTION
    # ========================================================

    print()
    print("1. Extracting PDF passages...")

    df = extract_passages(
        PDF_PATH
    )

    print(
        "Raw passages:",
        len(df),
    )

    # ========================================================
    # 2. CLEANING
    # ========================================================

    print()
    print("2. Cleaning passages...")

    df = clean_corpus(df)

    print(
        "Clean passages:",
        len(df),
    )

    # ========================================================
    # 3. VALIDATION
    # ========================================================

    print()
    print("3. Validating page numbers...")

    print(
        "Page min:",
        df["page"].min(),
    )

    print(
        "Page max:",
        df["page"].max(),
    )

    print(
        "Page 0 count:",
        (
            df["page"] == 0
        ).sum(),
    )

    # ========================================================
    # 4. SAVE CORPUS
    # ========================================================

    print()
    print(
        "4. Saving bulletin_passages.csv..."
    )

    df.to_csv(
        PASSAGE_OUTPUT,
        index=False,
    )

    # ========================================================
    # 5. SHOW SAMPLE
    # ========================================================

    print()
    print("Sample passages:")
    print()

    print(
        df[
            [
                "passage_id",
                "page",
                "subject",
                "course_code",
                "course_title",
                "text",
            ]
        ]
        .head(10)
        .to_string(
            index=False
        )
    )

    # ========================================================
    # 6. EMBEDDINGS
    # ========================================================

    print()
    print(
        "6. Generating semantic embeddings..."
    )

    model = SentenceTransformer(
        EMBEDDING_MODEL
    )

    embeddings = model.encode(
        df["text"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    print(
        "Embedding shape:",
        embeddings.shape,
    )

    # ========================================================
    # 7. UMAP
    # ========================================================

    print()
    print("7. Running UMAP...")

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=RANDOM_STATE,
    )

    coords = reducer.fit_transform(
        embeddings
    )

    df["x"] = coords[:, 0]

    df["y"] = coords[:, 1]

    # ========================================================
    # 8. KMEANS
    # ========================================================

    print()
    print("8. Running KMeans...")

    kmeans = KMeans(
        n_clusters=N_CLUSTERS,
        random_state=RANDOM_STATE,
        n_init="auto",
    )

    df["cluster"] = (
        kmeans.fit_predict(
            embeddings
        )
    )

    print()
    print("Cluster counts:")

    print(
        df["cluster"]
        .value_counts()
        .sort_index()
    )

    # ========================================================
    # 9. TOPIC LABELS
    # ========================================================

    print()
    print(
        "9. Generating topic labels..."
    )

    labels = generate_cluster_labels(
        df
    )

    df["cluster_name"] = (
        df["cluster"]
        .map(labels)
    )

    print()

    for cluster, label in labels.items():

        print(
            f"Cluster {cluster}: {label}"
        )

    # ========================================================
    # 10. SAVE EMBEDDING MAP
    # ========================================================

    print()
    print(
        "10. Saving lab8_embedding_map.csv..."
    )

    output_columns = [
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
        "y",
    ]

    df[
        output_columns
    ].to_csv(
        EMBEDDING_OUTPUT,
        index=False,
    )

    # ========================================================
    # 11. TOPIC × SECTION MATRIX
    # ========================================================

    print()
    print(
        "11. Saving topic-section matrix..."
    )

    matrix = (
        df.groupby(
            [
                "section",
                "cluster_name",
            ],
            dropna=False,
        )
        .size()
        .reset_index(
            name="count"
        )
    )

    matrix.to_csv(
        MATRIX_OUTPUT,
        index=False,
    )

    # ========================================================
    # 12. FINAL CHECK
    # ========================================================

    print()
    print("=" * 70)
    print("FINAL CHECK")
    print("=" * 70)

    print(
        "Rows:",
        len(df),
    )

    print(
        "Page min:",
        df["page"].min(),
    )

    print(
        "Page max:",
        df["page"].max(),
    )

    print(
        "Page 0:",
        (
            df["page"] == 0
        ).sum(),
    )

    print(
        "Empty text:",
        (
            df["text"]
            .str.strip()
            .eq("")
            .sum()
        ),
    )

    print()
    print("Files generated:")

    print(
        PASSAGE_OUTPUT
    )

    print(
        EMBEDDING_OUTPUT
    )

    print(
        MATRIX_OUTPUT
    )

    print()
    print("DONE.")


if __name__ == "__main__":
    main()