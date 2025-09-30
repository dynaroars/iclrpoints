def parse_faculties():

    inst_map = {}
    na = 0
    with open ("data/raw/country-info.csv", "r") as f, open("data/raw/csrankings.csv", "r") as f2:

        next(f)
        next(f2)
        for line in f:
            institution,region,countryabbrv = line.strip().split(",")
            if region == "canada":
                inst_map[institution] = ("north america", countryabbrv)
            else:
                inst_map[institution] = (region, countryabbrv)
        
        for line in f2:
            name,affiliation,homepage,scholarid = line.strip().split(",")
            if affiliation not in inst_map:
                inst_map[affiliation] = ("north america", "us")
                na += 1
        for value in inst_map.values():
            if value == "north america":
                na += 1

    print (na)

    with open("data/raw/csrankings.csv") as readfile, open("data/processed/faculties.csv", "w") as writefile:
        next(readfile)
        writefile.write("name,institution,homepage,scholarid,region,country\n")

        for line in readfile:
            name,affiliation,homepage,scholarid = line.strip().split(",")

            if affiliation in inst_map:
                region, country = inst_map[affiliation]
            else:
                region, country = "Unknown", "Unknown"

            row = f"{name},{affiliation},{homepage},{scholarid},{region},{country}\n"
            writefile.write(row)
    print("Written!")


parse_faculties()


