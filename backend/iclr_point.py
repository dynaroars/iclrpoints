import gzip
import xml.etree.ElementTree as ET

CSRANKINGS_PATH = "data/csrankings_march.csv"
AREA_PATH = "data/area.csv"
DBLP_PATH = "data/dblp.xml.gz"

_dblp_cache = None

def load_faculty_names(csrankings_path):
    faculty_set = set()
    with open(csrankings_path, "r") as f:
        next(f)
        for line in f:
            parts = line.strip().split(",")
            if len(parts) < 1:
                continue
            name = parts[0]
            faculty_set.add(name)
    return faculty_set

def load_conference_to_area(area_path):
    conf_to_area = {}
    area_to_parent = {}
    with open(area_path, "r") as f:
        next(f)
        for line in f:
            parent_area, area, abbrv, conference = line.strip().split(",")
            conf_to_area[conference] = area
            area_to_parent[area] = parent_area
    return conf_to_area, area_to_parent

def parse_dblp_full(dblp_path, conf_to_area, faculty_set):
    year_area_data = {}
    
    with gzip.open(dblp_path, "rb") as dblp_file:
        context = ET.iterparse(dblp_file, events=("end",))
        _, root = next(context)

        for _, elem in context:
            if elem.tag == "inproceedings":
                year_text = elem.findtext("year")
                booktitle = elem.findtext("booktitle")
                
                if not year_text or not booktitle:
                    root.clear()
                    continue

                try:
                    year = int(year_text)
                except ValueError:
                    root.clear()
                    continue

                area = None
                for conf, conf_area in conf_to_area.items():
                    if conf in booktitle:
                        area = conf_area
                        break

                if area:
                    if year not in year_area_data:
                        year_area_data[year] = {}
                    if area not in year_area_data[year]:
                        year_area_data[year][area] = {"pub_count": 0, "faculty": set()}
                    
                    year_area_data[year][area]["pub_count"] += 1

                    for author_elem in elem.findall("author"):
                        author_name = author_elem.text
                        if author_name and author_name in faculty_set:
                            year_area_data[year][area]["faculty"].add(author_name)
                            
            root.clear()
    
    return year_area_data

def get_cached_dblp_data(conf_to_area, faculty_set):
    global _dblp_cache
    if _dblp_cache is None:
        _dblp_cache = parse_dblp_full(DBLP_PATH, conf_to_area, faculty_set)
    return _dblp_cache

def compute_fractional_faculty(area_to_faculty):
    faculty_to_areas = {}
    for area, facs in area_to_faculty.items():
        for fac in facs:
            faculty_to_areas.setdefault(fac, set()).add(area)

    area_to_fraction_fact = {}
    for faculty, areas in faculty_to_areas.items():
        share = 1 / len(areas)
        for area in areas:
            area_to_fraction_fact[area] = area_to_fraction_fact.get(area, 0) + share

    return area_to_fraction_fact

def compute_iclr_points_all_years(faculty_set, conf_to_area, area_to_parent, years=None, baseline_area="Machine learning"):
    year_area_data = get_cached_dblp_data(conf_to_area, faculty_set)
    
    # Determine which years to aggregate
    available_years = sorted(year_area_data.keys())
    if years is None:
        years_to_aggregate = available_years
    else:
        years_to_aggregate = [y for y in years if y in available_years]
    
    if not years_to_aggregate:
        return []
    
    # Step 1: Aggregate data across selected years
    # Sum publications and union faculty sets
    aggregated_area_to_pub = {}
    aggregated_area_to_faculty = {}
    
    for year in years_to_aggregate:
        if year in year_area_data:
            for area, data in year_area_data[year].items():
                # Sum publications
                aggregated_area_to_pub[area] = aggregated_area_to_pub.get(area, 0) + data["pub_count"]
                # Union faculty sets
                if area not in aggregated_area_to_faculty:
                    aggregated_area_to_faculty[area] = set()
                aggregated_area_to_faculty[area].update(data["faculty"])
    
    if not aggregated_area_to_pub:
        return []
    
    # Step 2: Compute fractional faculty on aggregated data
    area_to_fraction_fact = compute_fractional_faculty(aggregated_area_to_faculty)
    
    # Step 3: Calculate baseline (Machine Learning) using aggregated data
    baseline_fact = area_to_fraction_fact.get(baseline_area)
    baseline_pubs = aggregated_area_to_pub.get(baseline_area)
    
    if baseline_fact is None or baseline_pubs is None or baseline_pubs == 0:
        return []
    
    baseline = baseline_fact / baseline_pubs
    
    # Step 4: Calculate ICLR points for each area using aggregated data
    all_rows = []
    for area in sorted(aggregated_area_to_pub.keys()):
        pubs = aggregated_area_to_pub[area]
        frac_fac = area_to_fraction_fact.get(area, 0)
        
        if pubs == 0:
            continue
        
        faculty_per_pub = frac_fac / pubs
        iclr_points = faculty_per_pub / baseline
        parent_area = area_to_parent.get(area)
        
        all_rows.append({
            "area": area,
            "parent": parent_area,
            "publication_count": pubs,
            "faculty_count": round(frac_fac, 2),
            "faculty_per_pub": round(faculty_per_pub, 6),
            "iclr_points": round(iclr_points, 2)
        })
    
    return all_rows
