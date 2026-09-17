import pandas as pd
import json

# Load GDP dataset
df = pd.read_csv("../data/lab6_assignment_gdp.csv")


def build_hierarchy(dataframe, levels):
    current_level = levels[0]

    # Last level = country
    if len(levels) == 1:
        return [
            {
                "name": row["country"],
                "gdp": row["gdp_billion_usd"],
                "status": row["gdp_status"]
            }
            for _, row in dataframe.iterrows()
        ]

    children = []

    for value, group in dataframe.groupby(current_level):
        children.append({
            "name": value,
            "children": build_hierarchy(
                group,
                levels[1:]
            )
        })

    return children


# Build hierarchy:
# World → Continent → Area → Country
hierarchy = {
    "name": "World",
    "children": build_hierarchy(
        df,
        ["continent", "area", "country"]
    )
}


# Save hierarchical JSON
with open(
    "../data/lab6_assignment_gdp.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        hierarchy,
        f,
        indent=2,
        ensure_ascii=False
    )

print("JSON created successfully!")
