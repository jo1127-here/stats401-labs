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
