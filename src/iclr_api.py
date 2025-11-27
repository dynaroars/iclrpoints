from fastapi import FastAPI
from fastapi.responses import JSONResponse
from iclr_point import load_faculty_names, load_conference_to_area, compute_iclr_points_year_range

app = FastAPI()

CSRANKINGS_PATH = "data/csrankings_march.csv"
AREA_PATH = "data/area.csv"

factuly_set = load_faculty_names(CSRANKINGS_PATH)
conf_to_area, area_to_parent = load_conference_to_area(AREA_PATH)

@app.get("/iclr_points")
def iclr_points(from_year, to_year):
    rows = compute_iclr_points_year_range(
        from_year, to_year,
        factuly_set,
        conf_to_area,
        area_to_parent
    )
    return JSONResponse(content=rows)