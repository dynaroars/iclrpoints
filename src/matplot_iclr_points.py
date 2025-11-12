import pandas as pd
import matplotlib.pyplot as plt

# 1) Load CSVs
points = pd.read_csv("data/iclr_points.csv", encoding="utf-8-sig")
areas  = pd.read_csv("data/area.csv", encoding="utf-8-sig")

# 2) Normalize column names
points.columns = points.columns.str.strip().str.lower()
areas.columns  = areas.columns.str.strip().str.lower()

# 3) Validate required columns
for need, dfname, cols in [
    ("iclr_points.csv", "points", ["area", "iclr_points"]),
    ("area.csv", "areas", ["area", "parent_area"])
]:
    for c in cols:
        if c not in eval(dfname).columns:
            raise KeyError(f"Column '{c}' not found in {need}. Available: {list(eval(dfname).columns)}")

# 4) Build Area → Parent mapping
area_to_parent = areas[["area", "parent_area"]].drop_duplicates(subset=["area"])

# 5) Merge parent area info into iclr points
df = points.merge(area_to_parent, on="area", how="left")
df["parent_area"] = df["parent_area"].fillna("Other")

# 6) Define the exact CSRankings structure order
parent_order = [
    "AI",
    "Systems",
    "Theory",
    "Interdisciplinary Areas"
]

# Create an ordered list of (parent_area, area) based on how they appear in area.csv
area_order = (
    areas[["parent_area", "area"]]
    .drop_duplicates()
    .sort_values(by=["parent_area"])
    .to_records(index=False)
)

# Build sort key: first by parent order, then by appearance within that parent
order_map = {}
rank = 0
for parent in parent_order:
    subset = [a for (p, a) in area_order if p == parent]
    for a in subset:
        order_map[a] = rank
        rank += 1

# Apply ordering to df
df["sort_order"] = df["area"].map(order_map)
df = df.sort_values("sort_order", ascending=True)

# 7) Assign same color per parent area
palette = list(plt.cm.tab10.colors)
parents = parent_order  # preserve CSRankings top-level order
color_map = {p: palette[i % len(palette)] for i, p in enumerate(parents)}
bar_colors = df["parent_area"].map(color_map)

# 8) Plot
plt.figure(figsize=(11, 8))
plt.barh(df["area"], df["iclr_points"], color=bar_colors)

plt.title("ICLR Points: How Many ICLR Publications Is One Paper in Each Area?", fontsize=14)
plt.xlabel("ICLR Points")
plt.ylabel("Area")

# Invert Y so AI is on top, Interdisciplinary at bottom
plt.gca().invert_yaxis()

# Value labels
for i, v in enumerate(df["iclr_points"]):
    plt.text(v + 0.05, i, f"{v:.2f}", va="center", fontsize=9)

plt.grid(axis="x", linestyle="--", alpha=0.5)
plt.tight_layout()
plt.show()
