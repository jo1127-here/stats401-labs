import os
import re

import fitz
import numpy as np
import pandas as pd

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
# 2. GENERAL TEXT CLEANING
# ============================================================

def clean_text(text):
    """
    General text cleaning.

    Keeps normal numbers because numbers can be legitimate
    parts of course descriptions.
    """

    if not isinstance(text, str):
        return ""

    # Remove PDF page artifacts
    text = re.sub(
        r"\bPAGE_\d+\s+\d{1,4}\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b\d{1,4}\s+PAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # Normalize whitespace
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

    # Normalize slash spacing
    text = re.sub(
        r"\s*/\s*",
        "/",
        text
    )

    return text.strip()


# ============================================================
# 3. PAGE CLEANING
# ============================================================

def clean_page_text(text):
    """
    Clean a page while preserving line breaks.

    Line breaks are important because course headings are
    detected from the beginning of lines.
    """

    if not isinstance(text, str):
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # Remove PAGE artifacts
    text = re.sub(
        r"\bPAGE_\d+\s+\d{1,4}\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b\d{1,4}\s+PAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # Normalize tabs/spaces, preserve newline
    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    # Remove spaces before punctuation
    text = re.sub(
        r"[ \t]+([,.;:!?])",
        r"\1",
        text
    )

    return text


# ============================================================
# 4. COURSE CODE
# ============================================================

COURSE_CODE_PATTERN = re.compile(
    r"""
    ^
    \s*
    (?P<code>
        [A-Z]{2,8}
        \s*
        \d{3}
        (?:
            \s*/\s*
            [A-Z]{2,8}
            \s*
            \d{3}
        )*
    )
    (?:
        \s+
        (?P<rest>.*)
    )?
    $
    """,
    flags=re.IGNORECASE | re.VERBOSE
)


def normalize_course_code(code):
    """
    Normalize:

        ARTS 201
        ARTS 201 / HIST 201
        HIST 207/ARTS 207

    into:

        ARTS 201
        ARTS 201/HIST 201
        HIST 207/ARTS 207
    """

    if not isinstance(code, str):
        return ""

    code = code.upper()

    code = re.sub(
        r"\s*/\s*",
        "/",
        code
    )

    code = re.sub(
        r"\s+",
        " ",
        code
    )

    return code.strip()


def get_subject(course_code):
    """
    First subject in the course code.

    ARTS 203/GCHINA 203
        -> ARTS
    """

    if not isinstance(course_code, str):
        return "UNKNOWN"

    match = re.match(
        r"^([A-Z]{2,8})\s*\d{3}",
        course_code.upper()
    )

    if match:
        return match.group(1)

    return "UNKNOWN"


# ============================================================
# 5. COURSE HEADING DETECTION
# ============================================================

def detect_course_heading(line):
    """
    Detect a course heading from ONE line.

    Examples accepted:

        ARTS 201 Introduction to Film Studies
        BIOL 201 Cell Biology
        ARTS 203/GCHINA 203 Visual China
        DKU 101

    Important:
        The course number MUST contain exactly 3 digits.

    Therefore:

        August 1896
        before 1900
        the 20

    are NOT courses.
    """

    if not isinstance(line, str):
        return None

    line = line.strip()

    if not line:
        return None

    # Remove PAGE artifacts before detection
    line = re.sub(
        r"\bPAGE_\d+\b",
        " ",
        line,
        flags=re.IGNORECASE
    ).strip()

    match = COURSE_CODE_PATTERN.match(line)

    if not match:
        return None

    code = normalize_course_code(
        match.group("code")
    )

    rest = match.group("rest") or ""
    rest = rest.strip()

    subject = get_subject(code)

    if subject == "UNKNOWN":
        return None

    # Reject obvious non-course headings
    bad_codes = {
        "PAGE",
        "COURSE",
        "SECTION",
        "CHAPTER",
    }

    if subject in bad_codes:
        return None

    # Reject if the entire remaining text is just numbers.
    # Example:
    #
    # DKU 101 0.0 26
    #
    # This is potentially a metadata line, so title will
    # be obtained from the following line.
    if rest and re.fullmatch(
        r"[\d.,\s]+",
        rest
    ):
        title = ""
    else:
        title = rest

    return {
        "code": code,
        "subject": subject,
        "title": title,
    }


# ============================================================
# 6. CREDIT EXTRACTION
# ============================================================

def extract_credits_from_header(text):
    """
    Try to extract credits from course-header metadata.

    Examples:

        4
        4.0
        3.0 268

    Returns:
        float or NaN
    """

    if not isinstance(text, str):
        return np.nan

    text = text.strip()

    # Explicit wording
    match = re.search(
        r"\b(\d+(?:\.\d+)?)\s*credits?\b",
        text,
        flags=re.IGNORECASE
    )

    if match:
        return float(match.group(1))

    # A small numeric value at the beginning.
    #
    # This handles layouts such as:
    #
    # 0.0 26
    #
    # where 0.0 is the credit value and 26 is
    # the printed page number.
    match = re.match(
        r"^\s*(\d+(?:\.\d+)?)\b",
        text
    )

    if match:
        value = float(match.group(1))

        if 0 <= value <= 20:
            return value

    return np.nan


def extract_credits(text):
    """
    Extract credits from the full course text.
    """

    if not isinstance(text, str):
        return np.nan

    # Explicit credits
    match = re.search(
        r"\b(\d+(?:\.\d+)?)\s*credits?\b",
        text,
        flags=re.IGNORECASE
    )

    if match:
        return float(match.group(1))

    # Non-credit
    if re.search(
        r"\bnon[- ]credit\b",
        text,
        flags=re.IGNORECASE
    ):
        return 0.0

    return np.nan


# ============================================================
# 7. REMOVE COURSE HEADER ARTIFACTS
# ============================================================

def clean_course_description(text):
    """
    Clean extracted course description.
    """

    if not isinstance(text, str):
        return ""

    # Remove PDF artifacts
    text = re.sub(
        r"\bPAGE_\d+\s+\d{1,4}\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b\d{1,4}\s+PAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPAGE_\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # Remove repeated section title
    text = re.sub(
        r"\bCourse Descriptions\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    # Normalize whitespace
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

    # Normalize slash
    text = re.sub(
        r"\s*/\s*",
        "/",
        text
    )

    return text.strip()


# ============================================================
# 8. FIND COURSE DESCRIPTIONS
# ============================================================

def extract_course_descriptions(pdf_path):

    print()
    print("=" * 70)
    print("EXTRACTING COURSE DESCRIPTIONS")
    print("=" * 70)

    doc = fitz.open(pdf_path)

    print(
        f"PDF pages: {len(doc)}"
    )

    # --------------------------------------------------------
    # Find Course Descriptions
    # --------------------------------------------------------
    start_page = None

    for i, page in enumerate(doc):
        text = page.get_text("text")

        # The table of contents mentions "Course Descriptions"
        # on page 8, but the actual section starts on PDF page 267.
        # We therefore require the page to contain actual course
        # headings such as "ARTS 201" or "COMPSCI 101".

        has_course_heading = re.search(
            r"^\s*[A-Z]{2,8}\s*\d{3}\b",
            text,
            flags=re.MULTILINE
        )

        if (
            re.search(
                r"\bCourse Descriptions\b",
                text,
                flags=re.IGNORECASE
            )
            and has_course_heading
        ):
            start_page = i
            break

    if start_page is None:
        raise ValueError(
            "Could not find the actual Course Descriptions section."
        )

    print(
        f"Course Descriptions starts around "
        f"PDF page {start_page + 1}"
    )
    # --------------------------------------------------------
    # Read all pages after Course Descriptions
    # --------------------------------------------------------

    page_lines = []

    stop_markers = {
        "Academic Policies",
        "Academic Regulations",
        "Student Affairs",
        "Appendix",
    }

    for page_index in range(
        start_page,
        len(doc)
    ):

        pdf_page = page_index + 1

        raw_text = doc[
            page_index
        ].get_text("text")

        cleaned = clean_page_text(
            raw_text
        )

        lines = cleaned.split("\n")

        stop_page = False

        for line in lines:

            stripped = line.strip()

            # Stop only if a line itself is a major section.
            # We do NOT use "if marker in raw_text" because
            # that can accidentally stop inside a course
            # description.
            if stripped in stop_markers:

                stop_page = True
                break

            page_lines.append(
                {
                    "page": pdf_page,
                    "text": stripped,
                }
            )

        if stop_page:
            print(
                f"Stopping at PDF page {pdf_page}"
            )
            break

    doc.close()

    # --------------------------------------------------------
    # Detect headings
    # --------------------------------------------------------

    headings = []

    for index, item in enumerate(page_lines):

        result = detect_course_heading(
            item["text"]
        )

        if result is None:
            continue

        headings.append(
            {
                "line_index": index,
                "page": item["page"],
                "code": result["code"],
                "subject": result["subject"],
                "title": result["title"],
            }
        )

    print()
    print(
        f"Potential course headings: {len(headings)}"
    )

    # --------------------------------------------------------
    # Show first detected headings
    # --------------------------------------------------------

    print()
    print("First detected course headings:")

    for heading in headings[:20]:

        print(
            f"  page {heading['page']} | "
            f"{heading['code']} | "
            f"{heading['title']}"
        )

    # --------------------------------------------------------
    # Remove duplicate headings
    # --------------------------------------------------------

    unique_headings = []

    seen = set()

    for heading in headings:

        key = (
            heading["line_index"],
            heading["page"],
            heading["code"],
        )

        if key in seen:
            continue

        seen.add(key)

        unique_headings.append(
            heading
        )

    headings = unique_headings

    print()
    print(
        f"Unique course headings: {len(headings)}"
    )

    if len(headings) < 5:

        print()
        print("=" * 70)
        print("COURSE EXTRACTION FAILED")
        print("=" * 70)

        print(
            "Fewer than 5 courses were detected."
        )

        print()
        print(
            "The first 80 non-empty lines near "
            "Course Descriptions are:"
        )

        shown = 0

        for item in page_lines:

            if not item["text"]:
                continue

            print(
                f"{item['page']:>4} | "
                f"{item['text']}"
            )

            shown += 1

            if shown >= 80:
                break

        raise ValueError(
            f"Only {len(headings)} courses were detected. "
            "Course extraction must be fixed before embeddings/UMAP."
        )

    # ========================================================
    # BUILD COURSE RECORDS
    # ========================================================

    rows = []

    for i, heading in enumerate(headings):

        start_line = heading["line_index"]

        if i + 1 < len(headings):

            end_line = headings[
                i + 1
            ]["line_index"]

        else:

            end_line = len(
                page_lines
            )

        # ----------------------------------------------------
        # Lines belonging to this course
        # ----------------------------------------------------

        course_lines = page_lines[
            start_line:end_line
        ]

        # ----------------------------------------------------
        # Course title
        # ----------------------------------------------------

        title = heading["title"].strip()

        # If the heading line has no title, use the next
        # meaningful line as title.
        #
        # Example:
        #
        # DKU 101 0.0 26
        # Introduction to Duke Kunshan University
        #
        if not title:

            for candidate in course_lines[1:]:

                candidate_text = (
                    candidate["text"].strip()
                )

                if not candidate_text:
                    continue

                # Skip metadata-only lines
                if re.fullmatch(
                    r"[\d.,\s]+",
                    candidate_text
                ):
                    continue

                title = candidate_text
                break

        # ----------------------------------------------------
        # Build description
        # ----------------------------------------------------

        description_lines = []

        # Everything after the heading line
        for line_item in course_lines[1:]:

            text = line_item["text"].strip()

            if not text:
                continue

            description_lines.append(
                text
            )

        raw_description = "\n".join(
            description_lines
        )

        # ----------------------------------------------------
        # If title came from next line, remove it from
        # description.
        # ----------------------------------------------------

        if title:

            description_lines_without_title = []

            title_removed = False

            for text in description_lines:

                if (
                    not title_removed
                    and text.strip() == title.strip()
                ):
                    title_removed = True
                    continue

                description_lines_without_title.append(
                    text
                )

            raw_description = "\n".join(
                description_lines_without_title
            )

        # ----------------------------------------------------
        # Credits
        # ----------------------------------------------------

        header_text = heading["title"]

        credits = extract_credits_from_header(
            header_text
        )

        # Check the line after heading for metadata.
        if pd.isna(credits):

            header_index = start_line + 1

            if header_index < len(page_lines):

                next_line = page_lines[
                    header_index
                ]["text"]

                possible_credits = (
                    extract_credits_from_header(
                        next_line
                    )
                )

                if not pd.isna(
                    possible_credits
                ):

                    credits = possible_credits

        # Search description for explicit credits
        if pd.isna(credits):

            credits = extract_credits(
                raw_description
            )

        # ----------------------------------------------------
        # Clean description
        # ----------------------------------------------------

        passage_text = clean_course_description(
            raw_description
        )

        # ----------------------------------------------------
        # If description accidentally begins with a
        # credit value, remove it.
        #
        # Example:
        #
        # 4.0 268
        # Actual description...
        # ----------------------------------------------------

        passage_text = re.sub(
            r"^\s*\d+(?:\.\d+)?\s+\d{1,4}\s+",
            "",
            passage_text
        )

        # ----------------------------------------------------
        # Non-credit
        # ----------------------------------------------------

        if pd.isna(credits):

            if re.search(
                r"\bnon[- ]credit\b",
                passage_text,
                flags=re.IGNORECASE
            ):
                credits = 0.0

        # ----------------------------------------------------
        # Final checks
        # ----------------------------------------------------

        code = heading["code"]
        subject = heading["subject"]
        page = heading["page"]

        if not code:
            continue

        if not title:
            continue

        if subject == "UNKNOWN":
            continue

        if not passage_text:
            continue

        # Avoid pure numeric garbage
        if re.fullmatch(
            r"[\d\s.,]+",
            passage_text
        ):
            continue

        # Avoid tiny accidental records
        if len(
            passage_text.split()
        ) < 5:
            continue

        rows.append(
            {
                "passage_id": (
                    f"course_{len(rows) + 1:04d}"
                ),
                "chapter": "Course Catalog",
                "section": "Course Descriptions",
                "subsection": title,
                "subject": subject,
                "course_code": code,
                "course_title": title,
                "credits": credits,
                "page": page,
                "text": passage_text,
            }
        )

    # ========================================================
    # DATAFRAME
    # ========================================================

    df = pd.DataFrame(rows)

    if df.empty:

        raise ValueError(
            "No valid courses were extracted."
        )

    # --------------------------------------------------------
    # Remove UNKNOWN
    # --------------------------------------------------------

    unknown_mask = (
        df["subject"]
        .astype(str)
        .str.upper()
        .eq("UNKNOWN")
    )

    unknown_mask |= (
        df["course_code"]
        .astype(str)
        .str.upper()
        .str.contains(
            "UNKNOWN",
            na=False
        )
    )

    unknown_mask |= (
        df["course_title"]
        .astype(str)
        .str.upper()
        .str.contains(
            "UNKNOWN",
            na=False
        )
    )

    removed_unknown = int(
        unknown_mask.sum()
    )

    df = df[
        ~unknown_mask
    ].copy()

    print()
    print(
        f"UNKNOWN rows removed: "
        f"{removed_unknown}"
    )

    # --------------------------------------------------------
    # Deduplicate
    # --------------------------------------------------------

    before = len(df)

    df = df.drop_duplicates(
        subset=[
            "course_code",
            "course_title",
            "text",
        ]
    ).copy()

    print(
        f"Duplicate rows removed: "
        f"{before - len(df)}"
    )

    # --------------------------------------------------------
    # Normalize
    # --------------------------------------------------------

    df["text"] = (
        df["text"]
        .astype(str)
        .apply(clean_text)
    )

    df["course_code"] = (
        df["course_code"]
        .astype(str)
        .apply(normalize_course_code)
    )

    df["subject"] = (
        df["subject"]
        .astype(str)
        .str.upper()
    )

    # --------------------------------------------------------
    # Counts
    # --------------------------------------------------------

    df["word_count"] = (
        df["text"]
        .str.split()
        .str.len()
    )

    df["char_count"] = (
        df["text"]
        .str.len()
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    df = df.sort_values(
        by=[
            "page",
            "subject",
            "course_code",
        ],
        na_position="last"
    ).reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # Re-number IDs
    # --------------------------------------------------------

    df["passage_id"] = [
        f"course_{i + 1:04d}"
        for i in range(len(df))
    ]

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    df.to_csv(
        PASSAGE_OUTPUT,
        index=False
    )

    print()
    print("=" * 70)
    print("EXTRACTION COMPLETE")
    print("=" * 70)

    print(
        f"Number of courses: {len(df)}"
    )

    print(
        f"Number of subjects: "
        f"{df['subject'].nunique()}"
    )

    print()
    print(
        "Subjects:"
    )

    print(
        df["subject"]
        .value_counts()
        .head(30)
        .to_string()
    )

    print()
    print(
        "First 15 courses:"
    )

    print(
        df[
            [
                "course_code",
                "course_title",
                "subject",
                "credits",
                "page",
            ]
        ]
        .head(15)
        .to_string(index=False)
    )

    print()
    print(
        f"Saved corpus:\n{PASSAGE_OUTPUT}"
    )

    return df


# ============================================================
# 9. CLEAN DATAFRAME
# ============================================================

def clean_dataframe(df):

    print()
    print("=" * 70)
    print("CLEANING DATAFRAME")
    print("=" * 70)

    df = df.copy()

    # Clean text
    df["text"] = (
        df["text"]
        .astype(str)
        .apply(clean_text)
    )

    # Remove empty
    df = df[
        df["text"].str.strip().ne("")
    ].copy()

    # Remove very short passages
    df = df[
        df["word_count"] >= 5
    ].copy()

    # Remove UNKNOWN
    unknown_mask = (
        df["subject"]
        .astype(str)
        .str.upper()
        .eq("UNKNOWN")
    )

    unknown_mask |= (
        df["course_code"]
        .astype(str)
        .str.upper()
        .str.contains(
            "UNKNOWN",
            na=False
        )
    )

    unknown_mask |= (
        df["course_title"]
        .astype(str)
        .str.upper()
        .str.contains(
            "UNKNOWN",
            na=False
        )
    )

    removed = int(
        unknown_mask.sum()
    )

    df = df[
        ~unknown_mask
    ].copy()

    print(
        f"UNKNOWN rows removed: {removed}"
    )

    # Deduplicate
    before = len(df)

    df = df.drop_duplicates(
        subset=[
            "course_code",
            "course_title",
            "text",
        ]
    ).copy()

    print(
        f"Duplicate rows removed: "
        f"{before - len(df)}"
    )

    # Recalculate counts
    df["word_count"] = (
        df["text"]
        .str.split()
        .str.len()
    )

    df["char_count"] = (
        df["text"]
        .str.len()
    )

    df = df.reset_index(
        drop=True
    )

    df["passage_id"] = [
        f"course_{i + 1:04d}"
        for i in range(len(df))
    ]

    if len(df) < 5:

        raise ValueError(
            f"Only {len(df)} courses remain after cleaning. "
            "Course extraction must be fixed before UMAP."
        )

    return df


# ============================================================
# 10. EMBEDDINGS
# ============================================================

def generate_embeddings(df):

    print()
    print("=" * 70)
    print("GENERATING EMBEDDINGS")
    print("=" * 70)

    model_name = "all-MiniLM-L6-v2"

    print(
        f"Model: {model_name}"
    )

    model = SentenceTransformer(
        model_name
    )

    texts = (
        df["text"]
        .astype(str)
        .tolist()
    )

    embeddings = model.encode(
        texts,
        show_progress_bar=True,
        convert_to_numpy=True
    )

    print(
        f"Embedding shape: "
        f"{embeddings.shape}"
    )

    return embeddings


# ============================================================
# 11. UMAP
# ============================================================

def run_umap(embeddings):

    print()
    print("=" * 70)
    print("RUNNING UMAP")
    print("=" * 70)

    n_samples = len(
        embeddings
    )

    if n_samples < 5:

        raise ValueError(
            f"Only {n_samples} courses were extracted. "
            "At least 5 courses are needed for UMAP."
        )

    n_neighbors = min(
        15,
        n_samples - 1
    )

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=0.15,
        metric="cosine",
        random_state=401,
    )

    embedding_2d = reducer.fit_transform(
        embeddings
    )

    print(
        f"UMAP shape: "
        f"{embedding_2d.shape}"
    )

    return embedding_2d


# ============================================================
# 12. KMEANS
# ============================================================

def run_clustering(
    embeddings,
    n_clusters=8
):

    print()
    print("=" * 70)
    print("RUNNING K-MEANS")
    print("=" * 70)

    n_samples = len(
        embeddings
    )

    n_clusters = min(
        n_clusters,
        n_samples
    )

    if n_clusters < 2:

        raise ValueError(
            "Not enough courses for clustering."
        )

    kmeans = KMeans(
        n_clusters=n_clusters,
        random_state=401,
        n_init=10,
    )

    labels = kmeans.fit_predict(
        embeddings
    )

    unique, counts = np.unique(
        labels,
        return_counts=True
    )

    print(
        "Cluster counts:"
    )

    for cluster_id, count in zip(
        unique,
        counts
    ):

        print(
            f"  Cluster {cluster_id}: "
            f"{count}"
        )

    return labels


# ============================================================
# 13. TOPIC NAMES
# ============================================================

def assign_topic_names(df):

    topic_names = {
        0: "Topic 0",
        1: "Topic 1",
        2: "Topic 2",
        3: "Topic 3",
        4: "Topic 4",
        5: "Topic 5",
        6: "Topic 6",
        7: "Topic 7",
    }

    df["cluster_name"] = (
        df["cluster"]
        .map(topic_names)
        .fillna("Other")
    )

    return df


# ============================================================
# 14. CORPUS SUMMARY
# ============================================================

def print_corpus_summary(df):

    print()
    print("=" * 70)
    print("CORPUS SUMMARY")
    print("=" * 70)

    print(
        f"Number of courses: {len(df)}"
    )

    print(
        f"Number of subjects: "
        f"{df['subject'].nunique()}"
    )

    if "cluster_name" in df.columns:

        print(
            f"Number of topics: "
            f"{df['cluster_name'].nunique()}"
        )

    print()

    print(
        f"Average words per course: "
        f"{df['word_count'].mean():.1f}"
    )

    print(
        f"Median words per course: "
        f"{df['word_count'].median():.1f}"
    )

    print(
        f"Minimum words: "
        f"{df['word_count'].min()}"
    )

    print(
        f"Maximum words: "
        f"{df['word_count'].max()}"
    )

    pages = pd.to_numeric(
        df["page"],
        errors="coerce"
    ).dropna()

    if len(pages) > 0:

        print(
            f"Page range: "
            f"{int(pages.min())} - "
            f"{int(pages.max())}"
        )

    print()
    print(
        "Credit distribution:"
    )

    print(
        df["credits"]
        .value_counts(
            dropna=False
        )
        .sort_index(
            na_position="last"
        )
        .to_string()
    )

    print()
    print(
        "Top subjects:"
    )

    print(
        df["subject"]
        .value_counts()
        .head(15)
        .to_string()
    )

    if "cluster_name" in df.columns:

        print()
        print(
            "Topic counts:"
        )

        print(
            df["cluster_name"]
            .value_counts()
            .sort_index()
            .to_string()
        )


# ============================================================
# 15. METADATA CHECK
# ============================================================

def check_metadata(df):

    print()
    print("=" * 70)
    print("METADATA CHECK")
    print("=" * 70)

    print()
    print("Columns:")
    print(
        list(df.columns)
    )

    print()
    print("Chapter:")
    print(
        df["chapter"]
        .value_counts()
        .to_string()
    )

    print()
    print("Section:")
    print(
        df["section"]
        .value_counts()
        .to_string()
    )

    print()
    print("Subjects:")
    print(
        df["subject"]
        .value_counts()
        .head(20)
        .to_string()
    )

    print()
    print("Sample courses:")

    print(
        df[
            [
                "course_code",
                "course_title",
                "subject",
                "credits",
                "page",
            ]
        ]
        .head(15)
        .to_string(index=False)
    )


# ============================================================
# 16. SAVE EMBEDDING DATA
# ============================================================

def save_embedding_data(
    df,
    embedding_2d
):

    print()
    print("=" * 70)
    print("SAVING EMBEDDING DATA")
    print("=" * 70)

    df = df.copy()

    df["x"] = embedding_2d[:, 0]
    df["y"] = embedding_2d[:, 1]

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
        "y",
    ]

    df[columns].to_csv(
        EMBEDDING_OUTPUT,
        index=False
    )

    print(
        f"Saved:\n{EMBEDDING_OUTPUT}"
    )

    return df


# ============================================================
# 17. TOPIC × SUBJECT MATRIX
# ============================================================

def create_matrix(df):

    print()
    print("=" * 70)
    print("CREATING TOPIC × SUBJECT MATRIX")
    print("=" * 70)

    matrix = (
        df.groupby(
            [
                "subject",
                "cluster_name",
            ]
        )
        .size()
        .unstack(
            fill_value=0
        )
    )

    matrix.to_csv(
        MATRIX_OUTPUT
    )

    print(
        f"Saved:\n{MATRIX_OUTPUT}"
    )

    print()
    print(matrix)

    return matrix


# ============================================================
# 18. REPRESENTATIVE COURSES
# ============================================================

def inspect_clusters(df):

    print()
    print("=" * 70)
    print("REPRESENTATIVE COURSES")
    print("=" * 70)

    for topic, group in (
        df.groupby(
            "cluster_name"
        )
    ):

        print()
        print(
            f"--- {topic} "
            f"({len(group)} courses) ---"
        )

        for _, row in (
            group.head(5).iterrows()
        ):

            print(
                f"{row['course_code']} | "
                f"{row['course_title']} | "
                f"{row['subject']} | "
                f"{row['credits']} credits | "
                f"page {row['page']}"
            )


# ============================================================
# 19. MAIN
# ============================================================

def main():

    print()
    print("=" * 70)
    print("LAB 8 - COURSE CATALOG CORPUS PIPELINE")
    print("=" * 70)

    # --------------------------------------------------------
    # Check PDF
    # --------------------------------------------------------

    if not os.path.exists(
        PDF_PATH
    ):

        raise FileNotFoundError(
            f"PDF not found:\n{PDF_PATH}"
        )

    os.makedirs(
        DATA_DIR,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Step 1: Extract
    # --------------------------------------------------------

    df = extract_course_descriptions(
        PDF_PATH
    )

    # --------------------------------------------------------
    # Step 2: Clean
    # --------------------------------------------------------

    df = clean_dataframe(
        df
    )

    # --------------------------------------------------------
    # Step 3: Metadata
    # --------------------------------------------------------

    check_metadata(
        df
    )

    # --------------------------------------------------------
    # Step 4: Summary
    # --------------------------------------------------------

    print_corpus_summary(
        df
    )

    # --------------------------------------------------------
    # Step 5: Embeddings
    # --------------------------------------------------------

    embeddings = generate_embeddings(
        df
    )

    # --------------------------------------------------------
    # Step 6: UMAP
    # --------------------------------------------------------

    embedding_2d = run_umap(
        embeddings
    )

    # --------------------------------------------------------
    # Step 7: KMeans
    # --------------------------------------------------------

    n_clusters = min(
        8,
        len(df)
    )

    labels = run_clustering(
        embeddings,
        n_clusters=n_clusters
    )

    df["cluster"] = labels

    # --------------------------------------------------------
    # Step 8: Topic names
    # --------------------------------------------------------

    df = assign_topic_names(
        df
    )

    # --------------------------------------------------------
    # Step 9: Final summary
    # --------------------------------------------------------

    print_corpus_summary(
        df
    )

    # --------------------------------------------------------
    # Step 10: Save embedding map
    # --------------------------------------------------------

    df = save_embedding_data(
        df,
        embedding_2d
    )

    # --------------------------------------------------------
    # Step 11: Topic × Subject matrix
    # --------------------------------------------------------

    create_matrix(
        df
    )

    # --------------------------------------------------------
    # Step 12: Representative courses
    # --------------------------------------------------------

    inspect_clusters(
        df
    )

    # --------------------------------------------------------
    # Done
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70)

    print()
    print(
        f"Courses: {len(df)}"
    )

    print(
        f"Subjects: "
        f"{df['subject'].nunique()}"
    )

    print()
    print("Output files:")

    print(
        f"  {PASSAGE_OUTPUT}"
    )

    print(
        f"  {EMBEDDING_OUTPUT}"
    )

    print(
        f"  {MATRIX_OUTPUT}"
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()
