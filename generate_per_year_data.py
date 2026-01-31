#!/usr/bin/env python3
import json
import sys
from backend.iclr_point import (
    CSRANKINGS_PATH, AREA_PATH,
    load_faculty_names, load_conference_to_area,
    get_cached_dblp_data,
    get_cached_dblp_conf_data,
)

def generate_per_year_data():
    faculty_set = load_faculty_names(CSRANKINGS_PATH)
    conf_to_area, area_to_parent = load_conference_to_area(AREA_PATH)
    year_area_data = get_cached_dblp_data(conf_to_area, faculty_set)
    year_conf_data = get_cached_dblp_conf_data(conf_to_area, faculty_set)

    if year_area_data is None:
        sys.exit(1)

    json_data = {
        "years": {},
        "years_by_conference": {},
        "area_to_parent": area_to_parent,
        "conference_to_area": conf_to_area,
        "available_areas": sorted(set(area_to_parent.keys())),
        "available_conferences": []
    }
    
    for year, area_data in year_area_data.items():
        year_str = str(year)
        json_data["years"][year_str] = {}
        
        for area, data in area_data.items():
            json_data["years"][year_str][area] = {
                "publication_count": data["publication_count"],
                "faculty_names": sorted(list(data["faculty_names"]))
            }

    conf_set = set()
    if year_conf_data:
        for year, confs in year_conf_data.items():
            year_str = str(year)
            json_data["years_by_conference"][year_str] = {}
            for conf, data in confs.items():
                conf_set.add(conf)
                json_data["years_by_conference"][year_str][conf] = {
                    "publication_count": data["publication_count"],
                    "faculty_names": sorted(list(data["faculty_names"])),
                    "area": conf_to_area.get(conf)
                }

    json_data["available_conferences"] = sorted(conf_set)
    
    with open("per_year_data.json", "w") as f:
        json.dump(json_data, f, indent=2)

if __name__ == "__main__":
    generate_per_year_data()
