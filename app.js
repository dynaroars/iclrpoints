var perYearData = null;
var BASELINE_CONFERENCE = "ICLR";

function isConferenceViewEnabled() {
    var el = document.getElementById("conference-view-toggle");
    return !!(el && el.checked);
}

function populateYearDropdowns() {
    var fromSelect = document.getElementById("from-year");
    var toSelect = document.getElementById("to-year");
    var currentYear = new Date().getFullYear();
    
    var defaultFrom = currentYear - 10;
    for (var year = 1970; year <= currentYear; year++) {
        var option1 = document.createElement("option");
        option1.value = year;
        option1.text = year;
        if (year === defaultFrom) option1.selected = true;
        fromSelect.appendChild(option1);
        
        var option2 = document.createElement("option");
        option2.value = year;
        option2.text = year;
        if (year === currentYear) option2.selected = true;
        toSelect.appendChild(option2);
    }
}

function populateBaselineDropdown(areas) {
    var select = document.getElementById("baseline-dropbox");
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

function computeFractionalFaculty(areaToFaculty) {
    var facultyToAreas = {};

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

function computeICLRPoints(fromYear, toYear, baselineArea) {
    if (!perYearData) {
        throw new Error("Data not loaded");
    }
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
            aggregatedPublicationCountByArea[area] =
                (aggregatedPublicationCountByArea[area] || 0) + data.publication_count;
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
    var areaToFractionalFacultyCount = computeFractionalFaculty(aggregatedFacultySetsByArea);
    var baselineFractionalFacultyCount = areaToFractionalFacultyCount[baselineArea];
    var baselinePublicationCount = aggregatedPublicationCountByArea[baselineArea];
    
    if (!baselineFractionalFacultyCount || !baselinePublicationCount || baselinePublicationCount === 0) {
        return [];
    }
    
    var baseline = baselineFractionalFacultyCount / baselinePublicationCount;
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
            iclr_points: Math.round(iclrPoints * 100) / 100
        });
    }
    
    return results;
}

function computeConferenceICLRPoints(fromYear, toYear, baselineConference) {
    if (!perYearData) {
        throw new Error("Data not loaded");
    }
    if (!perYearData.years_by_conference) {
        throw new Error("Conference-level data not available. Regenerate per_year_data.json.");
    }

    var aggregatedPublicationCountByConf = {};
    var aggregatedFacultySetsByConf = {};
    var conferenceToArea = perYearData.conference_to_area || {};

    for (var year = fromYear; year <= toYear; year++) {
        var yearStr = String(year);
        var yearData = perYearData.years_by_conference[yearStr];
        if (!yearData) continue;

        for (var conf in yearData) {
            var data = yearData[conf];
            aggregatedPublicationCountByConf[conf] =
                (aggregatedPublicationCountByConf[conf] || 0) + data.publication_count;

            if (!aggregatedFacultySetsByConf[conf]) {
                aggregatedFacultySetsByConf[conf] = [];
            }
            var existingSet = new Set(aggregatedFacultySetsByConf[conf]);
            for (var i = 0; i < data.faculty_names.length; i++) {
                existingSet.add(data.faculty_names[i]);
            }
            aggregatedFacultySetsByConf[conf] = Array.from(existingSet);

            if (!conferenceToArea[conf] && data.area) {
                conferenceToArea[conf] = data.area;
            }
        }
    }

    if (Object.keys(aggregatedPublicationCountByConf).length === 0) {
        return [];
    }

    var confToFractionalFacultyCount = computeFractionalFaculty(aggregatedFacultySetsByConf);
    var baselineFractionalFacultyCount = confToFractionalFacultyCount[baselineConference];
    var baselinePublicationCount = aggregatedPublicationCountByConf[baselineConference];

    if (!baselineFractionalFacultyCount || !baselinePublicationCount || baselinePublicationCount === 0) {
        return [];
    }

    var baseline = baselineFractionalFacultyCount / baselinePublicationCount;
    var results = [];
    var conferences = Object.keys(aggregatedPublicationCountByConf).sort();

    for (var i = 0; i < conferences.length; i++) {
        var conf = conferences[i];
        var publicationCount = aggregatedPublicationCountByConf[conf];
        var fractionalFacultyCount = confToFractionalFacultyCount[conf] || 0;
        if (publicationCount === 0) continue;

        var facultyPerPub = fractionalFacultyCount / publicationCount;
        var iclrPoints = facultyPerPub / baseline;
        var area = conferenceToArea[conf];
        var parentArea = area ? perYearData.area_to_parent[area] : null;

        results.push({
            label: conf,
            area: area,
            parent: parentArea,
            publication_count: publicationCount,
            faculty_count: Math.round(fractionalFacultyCount * 100) / 100,
            iclr_points: Math.round(iclrPoints * 100) / 100
        });
    }

    return results;
}

function getICLRPointsData(fromYear, toYear, baselineArea) {
    return loadPerYearData()
        .then(function() {
            return computeICLRPoints(fromYear, toYear, baselineArea);
        });
}

function getConferencePointsData(fromYear, toYear) {
    return loadPerYearData()
        .then(function() {
            return computeConferenceICLRPoints(fromYear, toYear, BASELINE_CONFERENCE);
        });
}

function updateChart(fromYear, toYear) {
    var conferenceView = isConferenceViewEnabled();
    var baselineSelect = document.getElementById("baseline-dropbox");
    if (baselineSelect) {
        baselineSelect.disabled = conferenceView;
        baselineSelect.title = conferenceView ? ("Baseline fixed to " + BASELINE_CONFERENCE + " in conference view") : "";
    }

    var dataPromise;
    var baselineArea = "Machine learning";
    if (conferenceView) {
        dataPromise = getConferencePointsData(fromYear, toYear);
    } else {
        baselineArea = (baselineSelect && baselineSelect.value) || "Machine learning";
        dataPromise = getICLRPointsData(fromYear, toYear, baselineArea);
    }

    dataPromise
        .then(function(data){
            var parentOrder= ["AI", "Systems", "Theory", "Interdisciplinary Areas"];
            var rows = [];
            if (conferenceView) {
                rows = data;
            } else {
                rows = data.map(function(r) {
                    return {
                        label: r.area,
                        area: r.area,
                        parent: r.parent,
                        publication_count: r.publication_count,
                        faculty_count: r.faculty_count,
                        iclr_points: r.iclr_points
                    };
                });
            }

            rows.sort(function(a,b) {
                var pa = parentOrder.indexOf(a.parent);
                var pb = parentOrder.indexOf(b.parent);
                if (pa !== pb) return pa - pb;
                return (a.label || "").localeCompare(b.label || "");
            });

            var areas = [];
            var values = [];
            var parents = [];
            var customdata = [];
            for(var i = rows.length - 1; i >= 0; i--) {
                var row = rows[i];
                areas.push(row.label);
                values.push(row.iclr_points);
                parents.push(row.parent);
                customdata.push([row.faculty_count, row.publication_count, row.area]);
            };
    
    var colorMap = {
        "AI": { fill: "rgba(31, 119, 180, 0.4)", line: "rgba(31, 119, 180, 0.9)" },
        "Systems": { fill: "rgba(255, 127, 14, 0.4)", line: "rgba(255, 127, 14, 0.9)" },
        "Theory": { fill: "rgba(44, 160, 44, 0.4)", line: "rgba(44, 160, 44, 0.9)" },
        "Interdisciplinary Areas": { fill: "rgba(148, 103, 189, 0.4)", line: "rgba(148, 103, 189, 0.9)" }
    };
    var defaultColor = { fill: "rgba(150, 150, 150, 0.4)", line: "rgba(150, 150, 150, 0.9)" };
    var barColors = parents.map(function(p){ return (colorMap[p] || defaultColor).fill; });
    var lineColors = parents.map(function(p){ return (colorMap[p] || defaultColor).line; });

    var hovertemplate;
    if (conferenceView) {
        hovertemplate = '<b>%{y}</b><br>' +
            'Area: %{customdata[2]}<br>' +
            'Faculty: %{customdata[0]}<br>' +
            'Publications: %{customdata[1]}<br>' +
            'ICLR Points: %{x:.2f}<br>' +
            'Baseline: ' + BASELINE_CONFERENCE + '<br>' +
            '<extra></extra>';
    } else {
        hovertemplate = '<b>%{y}</b><br>' +
            'Faculty: %{customdata[0]}<br>' +
            'Publications: %{customdata[1]}<br>' +
            'ICLR Points: %{x:.2f}<br>' +
            'Baseline: ' + baselineArea + '<br>' +
            '<extra></extra>';
    }

    var textPosition = 'inside';
    var textFontSize = conferenceView ? 14 : 16;

    var trace = {
        type: "bar",
        x: values,
        y: areas,
        orientation: "h",
        marker: {
            color: barColors,
            line: { 
                color: lineColors, 
                width: 0.8
            },
            opacity: 0.95
        },
        text: values.map(function(v) { return v.toFixed(2); }),
        textposition: textPosition,
        insidetextanchor: 'start',
        constraintext: 'none',
        cliponaxis: false,
        textfont: { 
            color: '#2c3e50', 
            size: textFontSize,
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

    var rowCount = areas.length || 1;
    var perRowPx = conferenceView ? 24 : 24;
    var minHeight = 760;
    var paddingPx = 220;
    var dynamicHeight = Math.max(minHeight, Math.round(rowCount * perRowPx + paddingPx));
    var xMax = values.length ? Math.max(2, Math.max.apply(null, values) * 1.08) : 7;

    var layout = {
        width: 760,
        height: dynamicHeight,
        margin: { l: 230, r: 120, t: 50, b: 20 },
        bargap: conferenceView ? 0.35 : 0.2,
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

        xaxis: {
          range: [0, xMax],
          autorange: false,
          fixedrange: true,
          dtick: 1,
          showgrid: true,
          gridcolor: "rgba(0,0,0,0.06)",
          gridwidth: 1,
          zeroline: false,
          showline: true,
          mirror: true,
          linecolor: 'rgba(0,0,0,0.3)',
          linewidth: 1,
          tickfont: {
              size: 11,
              color: '#7f8c8d',
              family: 'Arial, sans-serif'
          }
        },
      
        yaxis: {
          fixedrange: true,
          tickfont: { 
              size: 15,
              color: '#2c3e50',
              family: 'Arial, sans-serif'
          },
          automargin: true,
          showgrid: false,
          showline: true,
          mirror: true,
          linecolor: 'rgba(0,0,0,0.3)',
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

    var chartEl = document.getElementById("chart");
    if (chartEl && chartEl.data) {
        var prevLen = (chartEl.data[0] && chartEl.data[0].y && chartEl.data[0].y.length) ? chartEl.data[0].y.length : 0;
        var nextLen = areas.length;

        // When switching between area view and conference view the number of bars changes;
        // Plotly.animate can get flaky with length changes, so fall back to react.
        if (prevLen !== nextLen) {
            Plotly.react("chart", [trace], layout, config);
        } else {
            Plotly.animate("chart",
                { data: [trace], layout: layout },
                { transition: { duration: 500, easing: 'cubic-in-out' }, frame: { duration: 500 } }
            );
        }
    } else {
        Plotly.newPlot("chart", [trace], layout, config);
    }
        })
        .catch(function(error) {
        });
}

function getYearsFromInput() {
    var fromYear = parseInt(document.getElementById("from-year").value);
    var toYear = parseInt(document.getElementById("to-year").value);
    var currentYear = new Date().getFullYear();
    if (isNaN(fromYear)) fromYear = currentYear - 10;
    if (isNaN(toYear)) toYear = currentYear;
    return { from: fromYear, to: toYear};
}

function setup(){
    populateYearDropdowns();
    loadPerYearData()
        .then(function(data) {
            if (data.available_areas && data.available_areas.length > 0) {
                populateBaselineDropdown(data.available_areas);
            }
            var yrs = getYearsFromInput();
            updateChart(yrs.from, yrs.to);
        })
        .catch(function(error) {});

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

    var conferenceToggle = document.getElementById("conference-view-toggle");
    if (conferenceToggle) {
        conferenceToggle.addEventListener("change", function(){
            var yrs = getYearsFromInput();
            updateChart(yrs.from, yrs.to);
        });
    }
}

setup();

