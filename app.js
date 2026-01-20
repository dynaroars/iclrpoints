// Global variable for loaded per-year data
var perYearData = null;

function populateYearDropdowns() {
    var fromSelect = document.getElementById("from-year");
    var toSelect = document.getElementById("to-year");
    var currentYear = new Date().getFullYear();
    
    for (var year = 1970; year <= currentYear; year++) {
        var option1 = document.createElement("option");
        option1.value = year;
        option1.text = year;
        if (year === 2019) option1.selected = true;
        fromSelect.appendChild(option1);
        
        var option2 = document.createElement("option");
        option2.value = year;
        option2.text = year;
        if (year === 2023) option2.selected = true;
        toSelect.appendChild(option2);
    }
}

function populateBaselineDropdown(areas) {
    var select = document.getElementById("baseline-dropbox");
    // Clear existing options
    select.innerHTML = "";
    
    var sortedAreas = areas.sort();
    for (var i = 0; i < sortedAreas.length; i++) {
        var option = document.createElement("option");
        option.value = sortedAreas[i];
        option.text = sortedAreas[i];
        if (sortedAreas[i] === "Machine learning") option.selected = true;
        select.appendChild(option);
    }
}

// Load per-year data from JSON file
function loadPerYearData() {
    if (perYearData !== null) {
        return Promise.resolve(perYearData);
    }
    
    return fetch("per_year_data.json")
        .then(function(response) {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then(function(data) {
            perYearData = data;
            return data;
        });
}

// Compute fractional faculty (same logic as backend)
function computeFractionalFaculty(areaToFaculty) {
    var facultyToAreas = {};
    
    // Build reverse mapping: faculty -> areas they published in
    for (var area in areaToFaculty) {
        var facultyMembers = areaToFaculty[area];
        for (var i = 0; i < facultyMembers.length; i++) {
            var faculty = facultyMembers[i];
            if (!facultyToAreas[faculty]) {
                facultyToAreas[faculty] = [];
            }
            facultyToAreas[faculty].push(area);
        }
    }
    
    // Compute fractional counts
    var areaToFractionalFacultyCount = {};
    for (var faculty in facultyToAreas) {
        var areas = facultyToAreas[faculty];
        var share = 1 / areas.length;
        for (var i = 0; i < areas.length; i++) {
            var area = areas[i];
            areaToFractionalFacultyCount[area] = (areaToFractionalFacultyCount[area] || 0) + share;
        }
    }
    
    return areaToFractionalFacultyCount;
}

// Compute ICLR points (same logic as backend)
function computeICLRPoints(fromYear, toYear, baselineArea) {
    if (!perYearData) {
        throw new Error("Data not loaded");
    }
    
    // Step 1: Aggregate data across selected years
    var aggregatedPublicationCountByArea = {};
    var aggregatedFacultySetsByArea = {};
    
    for (var year = fromYear; year <= toYear; year++) {
        var yearStr = String(year);
        if (!perYearData.years[yearStr]) {
            continue;
        }
        
        var yearData = perYearData.years[yearStr];
        for (var area in yearData) {
            var data = yearData[area];
            
            // Sum publications
            aggregatedPublicationCountByArea[area] = 
                (aggregatedPublicationCountByArea[area] || 0) + data.publication_count;
            
            // Union faculty sets (avoid duplicates)
            if (!aggregatedFacultySetsByArea[area]) {
                aggregatedFacultySetsByArea[area] = [];
            }
            var existingSet = new Set(aggregatedFacultySetsByArea[area]);
            for (var i = 0; i < data.faculty_names.length; i++) {
                existingSet.add(data.faculty_names[i]);
            }
            aggregatedFacultySetsByArea[area] = Array.from(existingSet);
        }
    }
    
    if (Object.keys(aggregatedPublicationCountByArea).length === 0) {
        return [];
    }
    
    // Step 2: Compute fractional faculty
    var areaToFractionalFacultyCount = computeFractionalFaculty(aggregatedFacultySetsByArea);
    
    // Step 3: Calculate baseline
    var baselineFractionalFacultyCount = areaToFractionalFacultyCount[baselineArea];
    var baselinePublicationCount = aggregatedPublicationCountByArea[baselineArea];
    
    if (!baselineFractionalFacultyCount || !baselinePublicationCount || baselinePublicationCount === 0) {
        return [];
    }
    
    var baseline = baselineFractionalFacultyCount / baselinePublicationCount;
    
    // Step 4: Calculate ICLR points for each area
    var results = [];
    var areas = Object.keys(aggregatedPublicationCountByArea).sort();
    
    for (var i = 0; i < areas.length; i++) {
        var area = areas[i];
        var publicationCount = aggregatedPublicationCountByArea[area];
        var fractionalFacultyCount = areaToFractionalFacultyCount[area] || 0;
        
        if (publicationCount === 0) {
            continue;
        }
        
        var facultyPerPub = fractionalFacultyCount / publicationCount;
        var iclrPoints = facultyPerPub / baseline;
        var parentArea = perYearData.area_to_parent[area];
        
        results.push({
            area: area,
            parent: parentArea,
            publication_count: publicationCount,
            faculty_count: Math.round(fractionalFacultyCount * 100) / 100,
            faculty_per_pub: Math.round(facultyPerPub * 1000000) / 1000000,
            iclr_points: Math.round(iclrPoints * 100) / 100
        });
    }
    
    return results;
}

// Compute ICLR points from per-year data
function getICLRPointsData(fromYear, toYear, baselineArea) {
    return loadPerYearData()
        .then(function() {
            return computeICLRPoints(fromYear, toYear, baselineArea);
        });
}

function updateChart(fromYear, toYear) {

    var baselineArea = document.getElementById("baseline-dropbox").value || "Machine learning";
    // Compute ICLR points client-side from per-year data
    getICLRPointsData(fromYear, toYear, baselineArea)
        .then(function(data){
            // Data is computed client-side using same logic as backend
            var parentOrder= ["AI", "Systems", "Theory", "Interdisciplinary Areas"];
            data.sort(function(a,b) {
                var pa = parentOrder.indexOf(a.parent || a.parent_area);
                var pb = parentOrder.indexOf(b.parent || b.parent_area);
                if(pa !== pb) return pa - pb;
                return a.area.localeCompare(b.area);
            });

            var areas = [];
            var values = [];
            var parents = [];
            var customdata = [];
            for(var i = data.length - 1; i >= 0; i--) {
                var row = data[i];
                areas.push(row.area);
                values.push(row.iclr_points);
                parents.push(row.parent || row.parent_area);
                customdata.push([row.faculty_count, row.publication_count]);
            };
    
    var colorMap = {
        "AI": { fill: "rgba(31, 119, 180, 0.4)", line: "rgba(31, 119, 180, 0.9)", hover: "rgba(31, 119, 180, 0.6)" },
        "Systems": { fill: "rgba(255, 127, 14, 0.4)", line: "rgba(255, 127, 14, 0.9)", hover: "rgba(255, 127, 14, 0.6)" },
        "Theory": { fill: "rgba(44, 160, 44, 0.4)", line: "rgba(44, 160, 44, 0.9)", hover: "rgba(44, 160, 44, 0.6)" },
        "Interdisciplinary Areas": { fill: "rgba(148, 103, 189, 0.4)", line: "rgba(148, 103, 189, 0.9)", hover: "rgba(148, 103, 189, 0.6)" }
    };
    var defaultColor = { fill: "rgba(150, 150, 150, 0.4)", line: "rgba(150, 150, 150, 0.9)", hover: "rgba(150, 150, 150, 0.6)" };
    var barColors = parents.map(function(p){ return (colorMap[p] || defaultColor).fill; });
    var lineColors = parents.map(function(p){ return (colorMap[p] || defaultColor).line; });

    var hovertemplate = '<b>%{y}</b><br>' +
        'Faculty: %{customdata[0]}<br>' +
        'Publications: %{customdata[1]}<br>' +
        '<extra></extra>';

    var trace = {
        type: "bar",
        x: values,
        y: areas,
        orientation: "h",
        marker: {
            color: barColors,
            line: { 
                color: lineColors, 
                width: 1.8,
                smoothing: 1.0
            },
            opacity: 0.95
        },
        text: values.map(function(v) { return v.toFixed(2); }),
        textposition: 'inside',
        insidetextanchor: 'start',
        textfont: { 
            color: '#2c3e50', 
            size: 14,
            family: 'Arial, sans-serif'
        },
        customdata: customdata,
        hovertemplate: hovertemplate,
        hoverlabel: {
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            bordercolor: 'rgba(0, 0, 0, 0.2)',
            font: {
                family: 'Arial, sans-serif',
                size: 12,
                color: '#2c3e50'
            },
            namelength: -1
        }
    };

    var layout = {
        height: 700,
        margin: { l: 250, r: 250, t: 60, b: 20 },
        bargap: 0.2,
        bargroupgap: 0.05,
        title: {
            text: 'ICLR Points',
            font: {
                size: 18,
                color: '#2c3e50',
                family: 'Arial, sans-serif'
            },
            x: 0.5,
            xanchor: 'center',
            y: 0.98,
            yanchor: 'top'
        },
        transition: {
            duration: 500,
            easing: 'cubic-in-out'
        },

        xaxis: {
          range: [-0.1, 6],
          autorange: false,
          fixedrange: true,
          showgrid: true,
          gridcolor: "rgba(0,0,0,0.06)",
          gridwidth: 1,
          zeroline: false,
          tickfont: {
              size: 11,
              color: '#7f8c8d',
              family: 'Arial, sans-serif'
          }
        },
      
        yaxis: {
          fixedrange: true,
          tickfont: { 
              size: 12,
              color: '#2c3e50',
              family: 'Arial, sans-serif'
          },
          automargin: false,
          showgrid: false,
          linecolor: 'rgba(0,0,0,0.1)',
          linewidth: 1
        },
      
        showlegend: false,
        paper_bgcolor: "rgba(255, 255, 255, 0)",
        plot_bgcolor: "rgba(250, 250, 250, 0.3)",
        hovermode: 'closest',
        font: {
            family: 'Arial, sans-serif'
        }
      };
      

    var config = {
        displaylogo: false,
        displayModeBar: false,
        responsive: true,
        doubleClick: 'reset',
        showTips: false
    };

    if (document.getElementById("chart").data) {
        Plotly.animate("chart", {
            data: [trace],
            layout: layout,
            transition: {
                duration: 500,
                easing: 'cubic-in-out'
            },
            frame: {
                duration: 500
            }
        }, config);
    } else {
        Plotly.newPlot("chart", [trace], layout, config);
    }
        })
        .catch(function(error) {
            console.error("Error loading data:", error);
        });
}

function getYearsFromInput() {
    var fromYear = parseInt(document.getElementById("from-year").value);
    var toYear = parseInt(document.getElementById("to-year").value);
    if (isNaN(fromYear)) fromYear = 2019;
    if (isNaN(toYear)) toYear = 2023;
    return { from: fromYear, to: toYear};
}

function setup(){
    populateYearDropdowns();

    // Load per-year data and populate baseline dropdown
    loadPerYearData()
        .then(function(data) {
            // Populate baseline dropdown from available areas
            if (data.available_areas && data.available_areas.length > 0) {
                populateBaselineDropdown(data.available_areas);
            }
            
            // Initial load with default years
            var yrs = getYearsFromInput();
            updateChart(yrs.from, yrs.to);
        })
        .catch(function(error) {
            console.error("Error loading data:", error);
        });

    var from = document.getElementById("from-year");
    var to = document.getElementById("to-year");
    from.addEventListener("change", function(){
        var yrs = getYearsFromInput();
        updateChart(yrs.from, yrs.to);
    });
    to.addEventListener("change", function(){
        var yrs = getYearsFromInput();
        updateChart(yrs.from, yrs.to);
    });

    var baselineSelect = document.getElementById("baseline-dropbox");
    baselineSelect.addEventListener("change", function(){
        var yrs = getYearsFromInput();
        updateChart(yrs.from, yrs.to);
    });
}

setup();

