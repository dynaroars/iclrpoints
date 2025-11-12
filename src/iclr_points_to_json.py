import pandas as pd
iclr_points = pd.read_csv("data/iclr_points.csv")
parent_areas = pd.read_csv("data/area.csv")

df = iclr_points.merge(parent_areas[["area","parent_area"]].drop_duplicates(), on="area",how="left")
df["parent_area"] = df["parent_area"]

df.to_json("data/iclr_points.json", orient="records", indent=4)