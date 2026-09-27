// ============================================================
// Netflix Visualization Critique & Redesign
// ============================================================

const DATA_PATH = "data/netflix.csv";

let allData = [];
let filteredData = [];


// ============================================================
// 1. LOAD DATA
// ============================================================

d3.csv(DATA_PATH)
    .then(data => {

        allData = data
            .map(d => ({
                id: d.id,
                title: d.title,
                type: d.type,
                release_year: +d.release_year,
                age_certification: d.age_certification || "Unknown",
                runtime: +d.runtime || 0,
                seasons: +d.seasons || 0,
                imdb_score: +d.imdb_score || 0,
                imdb_votes: +d.imdb_votes || 0,
                country: d.country || "Unknown",
                genre: d.genre || ""
            }))
            .filter(d => !isNaN(d.release_year));

        console.log(`Loaded ${allData.length} Netflix titles.`);

        initializeControls();
        updateDashboard();

    })
    .catch(error => {

        console.error("Could not load data/netflix.csv:", error);

        const container = document.querySelector("#time-chart");

        if (container) {
            container.innerHTML = `
                <div style="
                    color:#e50914;
                    padding:30px;
                    font-family:Arial,sans-serif;
                ">
                    Could not load data/netflix.csv.
                    Please check the file path.
                </div>
            `;
        }
    });


// ============================================================
// 2. INITIALIZE CONTROLS
// ============================================================

function initializeControls() {

    const typeFilter = d3.select("#type-filter");

    if (!typeFilter.empty()) {

        typeFilter
            .on("change", function () {
                updateDashboard();
            });
    }


    const resetButton = d3.select("#reset-button");

    if (!resetButton.empty()) {

        resetButton
            .on("click", function () {

                const minYear = d3.min(allData, d => d.release_year);
                const maxYear = d3.max(allData, d => d.release_year);

                const sliders = getYearSliders();

                sliders.forEach(slider => {

                    if (slider.id === "year-start") {
                        slider.value = minYear;
                    }

                    if (slider.id === "year-end") {
                        slider.value = maxYear;
                    }
                });

                updateYearLabels();

                updateDashboard();
            });
    }


    // Find any range sliders currently present in the HTML.
    const sliders = document.querySelectorAll(
        'input[type="range"]'
    );

    sliders.forEach(slider => {

        slider.addEventListener("input", function () {

            updateYearLabels();
            updateDashboard();

        });

    });


    updateYearLabels();
}


// ============================================================
// 3. FIND YEAR SLIDERS
// ============================================================

function getYearSliders() {

    return Array.from(
        document.querySelectorAll('input[type="range"]')
    );
}


function getStartYear() {

    const sliders = getYearSliders();

    // Prefer an explicit year-start slider
    const start = sliders.find(
        s => s.id === "year-start"
    );

    if (start) {
        return +start.value;
    }

    // Otherwise use the first range slider
    if (sliders.length >= 1) {
        return +sliders[0].value;
    }

    // Fallback
    return d3.min(allData, d => d.release_year);
}


function getEndYear() {

    const sliders = getYearSliders();

    // Prefer an explicit year-end slider
    const end = sliders.find(
        s => s.id === "year-end"
    );

    if (end) {
        return +end.value;
    }

    // Otherwise use the second range slider
    if (sliders.length >= 2) {
        return +sliders[1].value;
    }

    // Fallback
    return d3.max(allData, d => d.release_year);
}


// ============================================================
// 4. UPDATE YEAR LABELS
// ============================================================

function updateYearLabels() {

    if (!allData.length) return;

    let startYear = getStartYear();
    let endYear = getEndYear();

    if (startYear > endYear) {

        const temp = startYear;
        startYear = endYear;
        endYear = temp;
    }


    const minLabel =
        document.querySelector("#year-min-value");

    const maxLabel =
        document.querySelector("#year-max-value");


    if (minLabel) {
        minLabel.textContent = startYear;
    }

    if (maxLabel) {
        maxLabel.textContent = endYear;
    }
}


// ============================================================
// 5. MAIN UPDATE FUNCTION
// ============================================================

function updateDashboard() {

    if (!allData.length) return;


    // --------------------------------------------------------
    // Controls
    // --------------------------------------------------------

    let type = "All";

    const typeElement =
        document.querySelector("#type-filter");

    if (typeElement) {
        type = typeElement.value;
    }


    let startYear = getStartYear();
    let endYear = getEndYear();


    if (startYear > endYear) {

        const temp = startYear;
        startYear = endYear;
        endYear = temp;
    }


    // --------------------------------------------------------
    // Filter data
    // --------------------------------------------------------

    filteredData = allData.filter(d => {

        const typeMatch =
            type === "All" ||
            type === "all" ||
            type === "" ||
            d.type === type;

        const yearMatch =
            d.release_year >= startYear &&
            d.release_year <= endYear;

        return typeMatch && yearMatch;
    });


    console.log(
        `Filtered data: ${filteredData.length} titles`
    );


    // --------------------------------------------------------
    // Draw visualizations
    // --------------------------------------------------------

    drawTimeChart(
        filteredData,
        startYear,
        endYear
    );

    drawGenreChart(filteredData);

    drawRatingChart(filteredData);

    drawCountryChart(filteredData);

    updateYearLabels();
}


// ============================================================
// 6. CLEAR SVG / CONTAINER
// ============================================================

function clearContainer(selector) {

    const container =
        d3.select(selector);

    if (container.empty()) {
        console.warn(
            `Container ${selector} was not found.`
        );
        return null;
    }

    container.selectAll("*").remove();

    return container;
}


// ============================================================
// 7. TIME SERIES
// ============================================================

function drawTimeChart(data, startYear, endYear) {

    const container =
        clearContainer("#time-chart");

    if (!container) return;


    const width =
        container.node().clientWidth || 900;

    const height = 400;

    const margin = {
        top: 35,
        right: 35,
        bottom: 55,
        left: 65
    };


    const svg = container
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        );


    const innerWidth =
        width -
        margin.left -
        margin.right;

    const innerHeight =
        height -
        margin.top -
        margin.bottom;


    const chart = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    // --------------------------------------------------------
    // Aggregate by year
    // --------------------------------------------------------

    const years = d3.range(
        startYear,
        endYear + 1
    );


    const movieByYear =
        d3.rollup(
            data.filter(d => d.type === "Movie"),
            v => v.length,
            d => d.release_year
        );


    const showByYear =
        d3.rollup(
            data.filter(d => d.type === "Show"),
            v => v.length,
            d => d.release_year
        );


    const movieData =
        years.map(year => ({
            year,
            value: movieByYear.get(year) || 0
        }));


    const showData =
        years.map(year => ({
            year,
            value: showByYear.get(year) || 0
        }));


    // --------------------------------------------------------
    // Scales
    // --------------------------------------------------------

    const x =
        d3.scaleLinear()
            .domain([startYear, endYear])
            .range([0, innerWidth]);


    const maxValue =
        d3.max(
            [...movieData, ...showData],
            d => d.value
        ) || 1;


    const y =
        d3.scaleLinear()
            .domain([0, maxValue])
            .nice()
            .range([innerHeight, 0]);


    // --------------------------------------------------------
    // Grid
    // --------------------------------------------------------

    chart
        .append("g")
        .attr("class", "grid")
        .call(
            d3.axisLeft(y)
                .tickSize(-innerWidth)
                .tickFormat("")
        );


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    chart
        .append("g")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(
            d3.axisBottom(x)
                .ticks(Math.min(10, years.length))
                .tickFormat(d3.format("d"))
        );


    chart
        .append("g")
        .call(
            d3.axisLeft(y)
                .ticks(6)
        );


    // --------------------------------------------------------
    // Lines
    // --------------------------------------------------------

    const line =
        d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);


    chart
        .append("path")
        .datum(movieData)
        .attr("class", "netflix-line movie-line")
        .attr("fill", "none")
        .attr("d", line);


    chart
        .append("path")
        .datum(showData)
        .attr("class", "netflix-line show-line")
        .attr("fill", "none")
        .attr("d", line);


    // --------------------------------------------------------
    // Points
    // --------------------------------------------------------

    addPoints(
        chart,
        movieData,
        x,
        y,
        "movie-point"
    );

    addPoints(
        chart,
        showData,
        x,
        y,
        "show-point"
    );


    // --------------------------------------------------------
    // Tooltip
    // --------------------------------------------------------

    const tooltip =
        getTooltip();


    const points =
        chart.selectAll(".data-point");


    points
        .on("mouseenter", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.type}</strong><br>
                    Year: ${d.year}<br>
                    Titles: ${d.value}
                `);

        })
        .on("mousemove", function(event) {

            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY - 30}px`);

        })
        .on("mouseleave", function() {

            tooltip
                .style("opacity", 0);

        });


    // --------------------------------------------------------
    // Legend
    // --------------------------------------------------------

    const legend =
        d3.select("#time-legend");

    if (!legend.empty()) {

        legend.html(`
            <span class="legend-item">
                <span class="legend-dot movie-dot"></span>
                Movies
            </span>

            <span class="legend-item">
                <span class="legend-dot show-dot"></span>
                TV Shows
            </span>
        `);
    }
}


// ============================================================
// 8. ADD POINTS
// ============================================================

function addPoints(
    chart,
    data,
    x,
    y,
    className
) {

    const type =
        className.includes("movie")
            ? "Movie"
            : "TV Show";


    chart
        .selectAll(`.${className}`)
        .data(data)
        .enter()
        .append("circle")
        .attr("class", `data-point ${className}`)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr(
            "fill",
            type === "Movie" ? "#e50914" : "#5bc0eb"
        )
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
        .attr("data-type", type);
}


// ============================================================
// 9. GENRE CHART
// ============================================================

function drawGenreChart(data) {

    const container =
        clearContainer("#genre-chart");

    if (!container) return;


    const genreCounts = new Map();


    data.forEach(d => {

        if (!d.genre) return;

        const genres =
            d.genre
                .split(",")
                .map(g => g.trim())
                .filter(Boolean);


        genres.forEach(genre => {

            genreCounts.set(
                genre,
                (genreCounts.get(genre) || 0) + 1
            );

        });

    });


    const genreData =
        Array.from(
            genreCounts,
            ([genre, count]) => ({
                genre,
                count
            })
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);


    drawHorizontalBarChart(
        container,
        genreData,
        "genre",
        "count",
        "Genre",
        420
    );
}


// ============================================================
// 10. AGE CERTIFICATION
// ============================================================

function drawRatingChart(data) {

    const container =
        clearContainer("#rating-chart");

    if (!container) return;


    const counts =
        d3.rollup(
            data,
            v => v.length,
            d => d.age_certification || "Unknown"
        );


    const ratingData =
        Array.from(
            counts,
            ([rating, count]) => ({
                rating,
                count
            })
        )
        .sort((a, b) => b.count - a.count);


    drawHorizontalBarChart(
        container,
        ratingData,
        "rating",
        "count",
        "Certification",
        360
    );
}


// ============================================================
// 11. COUNTRY
// ============================================================

function drawCountryChart(data) {

    const container =
        clearContainer("#country-chart");

    if (!container) return;


    const countryCounts = new Map();


    data.forEach(d => {

        if (!d.country) return;


        const countries =
            d.country
                .split(",")
                .map(c => c.trim())
                .filter(Boolean);


        countries.forEach(country => {

            countryCounts.set(
                country,
                (countryCounts.get(country) || 0) + 1
            );

        });

    });


    const countryData =
        Array.from(
            countryCounts,
            ([country, count]) => ({
                country,
                count
            })
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);


    drawHorizontalBarChart(
        container,
        countryData,
        "country",
        "count",
        "Country",
        420
    );
}


// ============================================================
// 12. GENERIC HORIZONTAL BAR CHART
// ============================================================

function drawHorizontalBarChart(
    container,
    data,
    categoryKey,
    valueKey,
    label,
    height
) {

    const width =
        container.node().clientWidth || 500;


    const margin = {
        top: 15,
        right: 30,
        bottom: 30,
        left: 115
    };


    const svg =
        container
            .append("svg")
            .attr("width", "100%")
            .attr("height", height)
            .attr(
                "viewBox",
                `0 0 ${width} ${height}`
            );


    const innerWidth =
        width -
        margin.left -
        margin.right;


    const innerHeight =
        height -
        margin.top -
        margin.bottom;


    const chart =
        svg.append("g")
            .attr(
                "transform",
                `translate(${margin.left},${margin.top})`
            );


    const y =
        d3.scaleBand()
            .domain(
                data.map(d => d[categoryKey])
            )
            .range([0, innerHeight])
            .padding(0.22);


    const x =
        d3.scaleLinear()
            .domain([
                0,
                d3.max(
                    data,
                    d => d[valueKey]
                ) || 1
            ])
            .nice()
            .range([0, innerWidth]);


    // Grid
    chart
        .append("g")
        .attr("class", "grid")
        .call(
            d3.axisBottom(x)
                .tickSize(innerHeight)
                .tickFormat("")
        )
        .attr(
            "transform",
            `translate(0,0)`
        );


    // Y axis
    chart
        .append("g")
        .call(
            d3.axisLeft(y)
        );


    // Bars
    chart
        .selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("fill", "#e50914")
        .attr("x", 0)
        .attr(
            "y",
            d => y(d[categoryKey])
        )
        .attr("height", y.bandwidth())
        .attr("width", 0)
        .on("mouseenter", function(event, d) {

            d3.select(this)
                .classed("bar-hover", true);

            const tooltip =
                getTooltip();

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d[categoryKey]}</strong><br>
                    Titles: ${d[valueKey].toLocaleString()}
                `);

        })
        .on("mousemove", function(event) {

            getTooltip()
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY - 30}px`
                );

        })
        .on("mouseleave", function() {

            d3.select(this)
                .classed("bar-hover", false);

            getTooltip()
                .style("opacity", 0);

        })
        .transition()
        .duration(700)
        .attr(
            "width",
            d => x(d[valueKey])
        );
}


// ============================================================
// 13. TOOLTIP
// ============================================================

function getTooltip() {

    let tooltip =
        d3.select("#tooltip");


    if (tooltip.empty()) {

        tooltip =
            d3.select("body")
                .append("div")
                .attr("id", "tooltip")
                .attr("class", "tooltip");
    }


    return tooltip;
}


// ============================================================
// 14. WINDOW RESIZE
// ============================================================

window.addEventListener(
    "resize",
    function() {

        if (allData.length) {
            updateDashboard();
        }

    }
);
