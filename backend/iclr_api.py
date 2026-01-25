from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.iclr_point import (
    CSRANKINGS_PATH, AREA_PATH,
    load_faculty_names, load_conference_to_area,
    compute_iclr_points_all_years,
    get_cached_dblp_data,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

faculty_set = load_faculty_names(CSRANKINGS_PATH)
conf_to_area, area_to_parent = load_conference_to_area(AREA_PATH)
get_cached_dblp_data(conf_to_area, faculty_set)

@app.get("/iclr_points_all")
def iclr_points_all(from_year: int = None, to_year: int = None, baseline_area: str = "Machine learning"):
    try:
        years = None
        if from_year is not None and to_year is not None:
            years = list(range(from_year, to_year + 1))
        
        rows = compute_iclr_points_all_years(
            faculty_set,
            conf_to_area,
            area_to_parent,
            years=years,
            baseline_area=baseline_area
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return JSONResponse(content=rows)
