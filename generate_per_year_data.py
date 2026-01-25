#!/usr/bin/env python3
import json
import sys
from backend.iclr_point import (
    CSRANKINGS_PATH, AREA_PATH,
    load_faculty_names, load_conference_to_area,
    get_cached_dblp_data
)

def generate_per_year_data():
    faculty_set = load_faculty_names(CSRANKINGS_PATH)
    conf_to_area, area_to_parent = load_conference_to_area(AREA_PATH)
    year_area_data = get_cached_dblp_data(conf_to_area, faculty_set)

    if year_area_data is None:
        sys.exit(1)

    json_data = {
        "years": {},
        "area_to_parent": area_to_parent,
        "available_areas": sorted(set(area_to_parent.keys()))
    }
    
    for year, area_data in year_area_data.items():
        year_str = str(year)
        json_data["years"][year_str] = {}
        
        for area, data in area_data.items():
            json_data["years"][year_str][area] = {
                "publication_count": data["publication_count"],
                "faculty_names": sorted(list(data["faculty_names"]))
            }
    
    with open("per_year_data.json", "w") as f:
        json.dump(json_data, f, indent=2)

if __name__ == "__main__":
    generate_per_year_data()
