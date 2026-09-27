// ============================================================
// NETFLIX CONTENT EVOLUTION
// Visualization Critique & Redesign
// D3.js v7
// ============================================================


// ============================================================
// GLOBAL STATE
// ============================================================

let allData = [];
let filteredData = [];

let selectedGenre = null;


// ============================================================
// CONSTANTS
// ============================================================

const RED = "#e50914";
const LIGHT = "#c7c7c7";
const MUTED = "#777";
const DARK_BAR = "#2d2d2d";

const margin = {
    top: 30,
    right: 90,
    bottom: 50,
    left: 55
};


// ============================================================
// LOAD DATA
// ============================================================

d3.csv("data/netflix.csv")
    .then(data => {

        allData = data
            .map(parseRow)
            .filter(d => !isNaN(d.release_year));

        console.log(
            `Loaded ${allData.length} Netflix titles.`
        );

        initializeFilters();
        updateDashboard();

    })
    .catch(error => {

        console.error(
            "Could not load netflix.csv:",
            error
        );

        d3.select("#time-chart")
            .append("div")
            .style("color", RED)
            .style("padding", "30px 0")
            .text(
                "Could not load data/netflix.csv. " +
                "Please check the file path."
            );
    });


// ============================================================
// PARSE ROW
// ============================================================

function parseRow(d) {

    return {

        id: d.id,

        title: d.title || "Unknown",

        type: (d.type || "").trim(),

        release_year: +d.release_year,

        age_certification:
            (d.age_certification || "Unknown").trim(),

        runtime: +d.runtime || 0,

        seasons: +d.seasons || 0,

        imdb_score: +d.imdb_score || 0,

        imdb_votes: +d.imdb_votes || 0,

        country:
            (d.country || "").trim(),

        genre:
            (d.genre || "").trim()
    };
}


// ============================================================
// FILTER INITIALIZATION
// ============================================================

function initializeFilters() {

    const minYear = d3.min(
        allData,
        d => d.release_year
    );

    const maxYear = d3.max(
        allData,
        d => d.release_year
    );


    const start = d3.select("#year-start");
    const end = d3.select("#year-end");


    start
        .attr("min", minYear)
        .attr("max", maxYear)
        .property("value", minYear);

    end
        .attr("min", minYear)
        .attr("max", maxYear)
        .property("value", maxYear);


    // Content type

    d3.select("#type-filter")
        .on("change", () => {

            selectedGenre = null;

            updateDashboard();
        });


    // Year range

    start.on("change", () => {

        selectedGenre = null;

        updateDashboard();
    });


    end.on("change", () => {

        selectedGenre = null;

        updateDashboard();
    });


    // Reset

    d3.select("#reset-button")
        .on("click", () => {

            d3.select("#type-filter")
                .property("value", "All");

            start.property("value", minYear);

            end.property("value", maxYear);

            selectedGenre = null;

            updateDashboard();
        });
}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {

    const type =
        d3.select("#type-filter")
            .property("value");


    let startYear =
        +d3.select("#year-start")
            .property("value");


    let endYear =
        +d3.select("#year-end")
            .property("value");


    if (startYear > endYear) {

        const temp = startYear;

        startYear = endYear;
        endYear = temp;

        d3.select("#year-start")
            .property("value", startYear);

        d3.select("#year-end")
            .property("value", endYear);
    }


    filteredData = allData.filter(d => {

        const typeMatch =
            type === "All" ||
            d.type === type;

        const yearMatch =
            d.release_year >= startYear &&
            d.release_year <= endYear;

        return typeMatch && yearMatch;
    });


    // Update period

    d3.select("#chart-period")
        .text(`${startYear} — ${endYear}`);


    // Update all components

    updateKPIs();

    updateTimeChart();

    updateGenreChart();

    updateRatingChart();

    updateCountryChart();
}


// ============================================================
// KPI
// ============================================================

function updateKPIs() {

    const total =
        filteredData.length;


    const movies =
        filteredData.filter(
            d => d.type === "Movie"
        ).length;


    const shows =
        filteredData.filter(
            d => d.type === "Show"
        ).length;


    const validScores =
        filteredData
            .map(d => d.imdb_score)
            .filter(d => d > 0);


    const averageScore =
        validScores.length
            ? d3.mean(validScores)
            : null;


    d3.select("#total-titles")
        .text(d3.format(",")(total));


    d3.select("#total-movies")
        .text(d3.format(",")(movies));


    d3.select("#total-shows")
        .text(d3.format(",")(shows));


    d3.select("#avg-score")
        .text(
            averageScore === null
                ? "—"
                : averageScore.toFixed(2)
        );
}


// ============================================================
// TIME SERIES
// ============================================================

function updateTimeChart() {

    const container =
        d3.select("#time-chart");


    container
        .selectAll("*")
        .remove();


    if (!filteredData.length) {

        container
            .append("p")
            .style("color", MUTED)
            .text("No data for this selection.");

        return;
    }


    const node = container.node();

    const width =
        node.getBoundingClientRect().width;


    const height = 500;


    const innerWidth =
        width -
        margin.left -
        margin.right;


    const innerHeight =
        height -
        margin.top -
        margin.bottom;


    // --------------------------------------------------------
    // YEAR DATA
    // --------------------------------------------------------

    const yearly = d3.rollups(
        filteredData,

        v => v.length,

        d => d.release_year,

        d => d.type
    );


    const movieMap = new Map();

    const showMap = new Map();


    yearly.forEach(([year, types]) => {

        const typeMap =
            new Map(types);

        movieMap.set(
            year,
            typeMap.get("Movie") || 0
        );

        showMap.set(
            year,
            typeMap.get("Show") || 0
        );
    });


    const minYear =
        d3.min(
            filteredData,
            d => d.release_year
        );


    const maxYear =
        d3.max(
            filteredData,
            d => d.release_year
        );


    const years =
        d3.range(
            minYear,
            maxYear + 1
        );


    const movieData =
        years.map(year => ({
            year,
            value: movieMap.get(year) || 0
        }));


    const showData =
        years.map(year => ({
            year,
            value: showMap.get(year) || 0
        }));


    // --------------------------------------------------------
    // SVG
    // --------------------------------------------------------

    const svg =
        container
            .append("svg")
            .attr("width", width)
            .attr("height", height);


    const g =
        svg.append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top}
                )`
            );


    // --------------------------------------------------------
    // SCALES
    // --------------------------------------------------------

    const x =
        d3.scaleLinear()
            .domain([minYear, maxYear])
            .range([0, innerWidth]);


    const maxValue =
        d3.max([
            d3.max(movieData, d => d.value),
            d3.max(showData, d => d.value)
        ]);


    const y =
        d3.scaleLinear()
            .domain([0, maxValue])
            .nice()
            .range([innerHeight, 0]);


    // --------------------------------------------------------
    // GRID
    // --------------------------------------------------------

    g.append("g")
        .selectAll("line")
        .data(y.ticks(6))
        .join("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr(
            "y1",
            d => y(d)
        )
        .attr(
            "y2",
            d => y(d)
        );


    // --------------------------------------------------------
    // AXIS
    // --------------------------------------------------------

    g.append("g")
        .attr("class", "axis")
        .attr(
            "transform",
            `translate(
                0,
                ${innerHeight}
            )`
        )
        .call(
            d3.axisBottom(x)
                .ticks(
                    Math.min(
                        8,
                        years.length
                    )
                )
                .tickFormat(
                    d3.format("d")
                )
        );


    g.append("g")
        .attr("class", "axis")
        .call(
            d3.axisLeft(y)
                .ticks(6)
                .tickFormat(
                    d3.format(",")
                )
        );


    // --------------------------------------------------------
    // LINE GENERATOR
    // --------------------------------------------------------

    const line =
        d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .curve(
                d3.curveMonotoneX
            );


    // --------------------------------------------------------
    // MOVIE LINE
    // --------------------------------------------------------

    g.append("path")
        .datum(movieData)
        .attr(
            "class",
            "movie-line"
        )
        .attr("fill", "none")
        .attr("d", line);


    // --------------------------------------------------------
    // SHOW LINE
    // --------------------------------------------------------

    g.append("path")
        .datum(showData)
        .attr(
            "class",
            "show-line"
        )
        .attr("fill", "none")
        .attr("d", line);


    // --------------------------------------------------------
    // END LABELS
    // --------------------------------------------------------

    addEndLabel(
        g,
        movieData,
        x,
        y,
        "Movie",
        RED
    );


    addEndLabel(
        g,
        showData,
        x,
        y,
        "TV Show",
        LIGHT
    );


    // --------------------------------------------------------
    // INTERACTION POINTS
    // --------------------------------------------------------

    addInteractivePoints(
        g,
        movieData,
        x,
        y,
        "Movie"
    );


    addInteractivePoints(
        g,
        showData,
        x,
        y,
        "TV Show"
    );
}


// ============================================================
// END LABEL
// ============================================================

function addEndLabel(
    g,
    data,
    x,
    y,
    label,
    color
) {

    const valid =
        data.filter(
            d => d.value > 0
        );


    if (!valid.length) return;


    const last =
        valid[valid.length - 1];


    const group =
        g.append("g")
            .attr(
                "transform",
                `translate(
                    ${x(last.year) + 10},
                    ${y(last.value)}
                )`
            );


    group.append("circle")
        .attr("r", 4)
        .attr(
            "fill",
            color
        );


    group.append("text")
        .attr(
            "class",
            "line-end-label"
        )
        .attr(
            "x",
            10
        )
        .attr(
            "y",
            -5
        )
        .attr(
            "fill",
            color
        )
        .text(label);


    group.append("text")
        .attr(
            "class",
            "line-end-value"
        )
        .attr(
            "x",
            10
        )
        .attr(
            "y",
            11
        )
        .text(
            d3.format(",")(last.value)
        );
}


// ============================================================
// INTERACTIVE POINTS
// ============================================================

function addInteractivePoints(
    g,
    data,
    x,
    y,
    type
) {

    g.selectAll(
        `.point-${type.replace(" ", "-")}`
    )
        .data(
            data.filter(
                d => d.value > 0
            )
        )
        .join("circle")
        .attr(
            "class",
            `time-point point-${type.replace(" ", "-")}`
        )
        .attr(
            "cx",
            d => x(d.year)
        )
        .attr(
            "cy",
            d => y(d.value)
        )
        .attr("r", 5)

        .on("mouseenter", function(event, d) {

            d3.select(this)
                .style("opacity", 1)
                .attr("r", 7);

            showTooltip(
                event,

                `
                <div class="tooltip-title">
                    ${type}
                </div>

                <div class="tooltip-value">
                    ${d.year}
                    ·
                    ${d3.format(",")(d.value)}
                    titles
                </div>
                `
            );
        })

        .on("mousemove", moveTooltip)

        .on("mouseleave", function() {

            d3.select(this)
                .style("opacity", 0)
                .attr("r", 5);

            hideTooltip();
        });
}


// ============================================================
// GENRE DATA
// ============================================================

function getGenreData(data) {

    const counts =
        new Map();


    data.forEach(d => {

        if (!d.genre) return;


        d.genre
            .split(",")
            .map(g => g.trim())
            .filter(Boolean)
            .forEach(genre => {

                counts.set(
                    genre,
                    (counts.get(genre) || 0) + 1
                );
            });
    });


    return Array.from(
        counts,
        ([genre, count]) => ({
            genre,
            count
        })
    )
        .sort(
            (a, b) =>
                b.count - a.count
        )
        .slice(0, 10);
}


// ============================================================
// GENRE CHART
// ============================================================

function updateGenreChart() {

    const container =
        d3.select("#genre-chart");


    container
        .selectAll("*")
        .remove();


    const data =
        getGenreData(filteredData);


    if (!data.length) return;


    const width =
        container
            .node()
            .getBoundingClientRect()
            .width;


    const height =
        400;


    const left = 105;
    const right = 65;
    const top = 10;
    const bottom = 20;


    const innerWidth =
        width - left - right;


    const innerHeight =
        height - top - bottom;


    const svg =
        container
            .append("svg")
            .attr("width", width)
            .attr("height", height);


    const g =
        svg.append("g")
            .attr(
                "transform",
                `translate(
                    ${left},
                    ${top}
                )`
            );


    const x =
        d3.scaleLinear()
            .domain([
                0,
                d3.max(
                    data,
                    d => d.count
                )
            ])
            .range([
                0,
                innerWidth
            ]);


    const y =
        d3.scaleBand()
            .domain(
                data.map(
                    d => d.genre
                )
            )
            .range([
                0,
                innerHeight
            ])
            .padding(0.38);


    // subtle reference line

    g.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr(
            "stroke",
            "#333"
        );


    // bars

    g.selectAll(".genre-bar")
        .data(data)
        .join("rect")
        .attr(
            "class",
            "genre-bar"
        )
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            d => y(d.genre)
        )
        .attr(
            "height",
            y.bandwidth()
        )
        .attr(
            "width",
            d => x(d.count)
        )
        .classed(
            "selected",
            d =>
                selectedGenre === d.genre
        )

        .on("mouseenter", function(event, d) {

            showTooltip(
                event,

                `
                <div class="tooltip-title">
                    ${d.genre}
                </div>

                <div class="tooltip-value">
                    ${d3.format(",")(d.count)}
                    titles
                </div>
                `
            );

            if (
                selectedGenre !== d.genre
            ) {

                d3.select(this)
                    .attr(
                        "fill",
                        RED
                    );
            }
        })

        .on("mousemove", moveTooltip)

        .on("mouseleave", function(event, d) {

            hideTooltip();

            if (
                selectedGenre !== d.genre
            ) {

                d3.select(this)
                    .attr(
                        "fill",
                        DARK_BAR
                    );
            }
        })

        .on("click", function(event, d) {

            if (
                selectedGenre === d.genre
            ) {

                selectedGenre = null;

            } else {

                selectedGenre = d.genre;
            }


            updateGenreChart();

            updateGenreStatus();
        });


    // labels

    g.selectAll(".genre-label")
        .data(data)
        .join("text")
        .attr(
            "class",
            "genre-label"
        )
        .attr(
            "x",
            -14
        )
        .attr(
            "y",
            d =>
                y(d.genre) +
                y.bandwidth() / 2
        )
        .attr(
            "text-anchor",
            "end"
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d => d.genre
        );


    // counts

    g.selectAll(".genre-count")
        .data(data)
        .join("text")
        .attr(
            "class",
            "genre-count"
        )
        .attr(
            "x",
            d =>
                x(d.count) + 10
        )
        .attr(
            "y",
            d =>
                y(d.genre) +
                y.bandwidth() / 2
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d =>
                d3.format(",")(
                    d.count
                )
        );
}


// ============================================================
// GENRE STATUS
// ============================================================

function updateGenreStatus() {

    const element =
        d3.select(
            "#genre-selection"
        );


    if (!selectedGenre) {

        element.text(
            "Click a genre to highlight it."
        );

        return;
    }


    const count =
        getGenreData(filteredData)
            .find(
                d =>
                    d.genre ===
                    selectedGenre
            );


    if (!count) {

        element.text("");

        return;
    }


    element.text(
        `${selectedGenre} · ${d3.format(",")(count.count)} titles`
    );
}


// ============================================================
// RATING DATA
// ============================================================

function getRatingData(data) {

    return d3.rollups(

        data,

        v => v.length,

        d =>
            d.age_certification ||
            "Unknown"

    )
        .map(
            ([rating, count]) => ({
                rating,
                count
            })
        )
        .sort(
            (a, b) =>
                b.count - a.count
        );
}


// ============================================================
// RATING CHART
// ============================================================

function updateRatingChart() {

    const container =
        d3.select("#rating-chart");


    container
        .selectAll("*")
        .remove();


    const data =
        getRatingData(
            filteredData
        );


    const width =
        container
            .node()
            .getBoundingClientRect()
            .width;


    const height = 400;


    const left = 95;
    const right = 60;
    const top = 10;
    const bottom = 20;


    const innerWidth =
        width - left - right;


    const innerHeight =
        height - top - bottom;


    const svg =
        container
            .append("svg")
            .attr("width", width)
            .attr("height", height);


    const g =
        svg.append("g")
            .attr(
                "transform",
                `translate(
                    ${left},
                    ${top}
                )`
            );


    const x =
        d3.scaleLinear()
            .domain([
                0,
                d3.max(
                    data,
                    d => d.count
                )
            ])
            .range([
                0,
                innerWidth
            ]);


    const y =
        d3.scaleBand()
            .domain(
                data.map(
                    d => d.rating
                )
            )
            .range([
                0,
                innerHeight
            ])
            .padding(0.32);


    g.selectAll(".rating-bar")
        .data(data)
        .join("rect")
        .attr(
            "class",
            "rating-bar"
        )
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            d => y(d.rating)
        )
        .attr(
            "height",
            y.bandwidth()
        )
        .attr(
            "width",
            d => x(d.count)
        )

        .on("mouseenter", function(event, d) {

            d3.select(this)
                .attr(
                    "fill",
                    RED
                );

            showTooltip(
                event,

                `
                <div class="tooltip-title">
                    ${d.rating}
                </div>

                <div class="tooltip-value">
                    ${d3.format(",")(d.count)}
                    titles
                </div>
                `
            );
        })

        .on("mousemove", moveTooltip)

        .on("mouseleave", function() {

            d3.select(this)
                .attr(
                    "fill",
                    "#333"
                );

            hideTooltip();
        });


    g.selectAll(".rating-label")
        .data(data)
        .join("text")
        .attr(
            "class",
            "rating-label"
        )
        .attr(
            "x",
            -12
        )
        .attr(
            "y",
            d =>
                y(d.rating) +
                y.bandwidth() / 2
        )
        .attr(
            "text-anchor",
            "end"
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d => d.rating
        );


    g.selectAll(".rating-count")
        .data(data)
        .join("text")
        .attr(
            "class",
            "rating-count"
        )
        .attr(
            "x",
            d =>
                x(d.count) + 10
        )
        .attr(
            "y",
            d =>
                y(d.rating) +
                y.bandwidth() / 2
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d =>
                d3.format(",")(
                    d.count
                )
        );
}


// ============================================================
// COUNTRY DATA
// ============================================================

function getCountryData(data) {

    const counts =
        new Map();


    data.forEach(d => {

        if (!d.country) return;


        d.country
            .split(",")
            .map(
                c => c.trim()
            )
            .filter(Boolean)
            .forEach(country => {

                counts.set(
                    country,
                    (counts.get(country) || 0) + 1
                );
            });
    });


    return Array.from(
        counts,
        ([country, count]) => ({
            country,
            count
        })
    )
        .sort(
            (a, b) =>
                b.count - a.count
        )
        .slice(0, 10);
}


// ============================================================
// COUNTRY CHART
// ============================================================

function updateCountryChart() {

    const container =
        d3.select("#country-chart");


    container
        .selectAll("*")
        .remove();


    const data =
        getCountryData(
            filteredData
        );


    const width =
        container
            .node()
            .getBoundingClientRect()
            .width;


    const height = 400;


    const left = 80;
    const right = 70;
    const top = 10;
    const bottom = 20;


    const innerWidth =
        width - left - right;


    const innerHeight =
        height - top - bottom;


    const svg =
        container
            .append("svg")
            .attr("width", width)
            .attr("height", height);


    const g =
        svg.append("g")
            .attr(
                "transform",
                `translate(
                    ${left},
                    ${top}
                )`
            );


    const x =
        d3.scaleLinear()
            .domain([
                0,
                d3.max(
                    data,
                    d => d.count
                )
            ])
            .range([
                0,
                innerWidth
            ]);


    const y =
        d3.scaleBand()
            .domain(
                data.map(
                    d => d.country
                )
            )
            .range([
                0,
                innerHeight
            ])
            .padding(0.35);


    g.selectAll(".country-bar")
        .data(data)
        .join("rect")
        .attr(
            "class",
            "country-bar"
        )
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            d => y(d.country)
        )
        .attr(
            "height",
            y.bandwidth()
        )
        .attr(
            "width",
            d => x(d.count)
        )

        .on("mouseenter", function(event, d) {

            d3.select(this)
                .attr(
                    "fill",
                    RED
                );

            showTooltip(
                event,

                `
                <div class="tooltip-title">
                    ${d.country}
                </div>

                <div class="tooltip-value">
                    ${d3.format(",")(d.count)}
                    titles
                </div>
                `
            );
        })

        .on("mousemove", moveTooltip)

        .on("mouseleave", function() {

            d3.select(this)
                .attr(
                    "fill",
                    "#333"
                );

            hideTooltip();
        });


    g.selectAll(".country-label")
        .data(data)
        .join("text")
        .attr(
            "class",
            "country-label"
        )
        .attr(
            "x",
            -12
        )
        .attr(
            "y",
            d =>
                y(d.country) +
                y.bandwidth() / 2
        )
        .attr(
            "text-anchor",
            "end"
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d => d.country
        );


    g.selectAll(".country-count")
        .data(data)
        .join("text")
        .attr(
            "class",
            "country-count"
        )
        .attr(
            "x",
            d =>
                x(d.count) + 10
        )
        .attr(
            "y",
            d =>
                y(d.country) +
                y.bandwidth() / 2
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .text(
            d =>
                d3.format(",")(
                    d.count
                )
        );
}


// ============================================================
// TOOLTIP
// ============================================================

function showTooltip(
    event,
    html
) {

    const tooltip =
        d3.select(
            "#d3-tooltip"
        );


    tooltip
        .html(html)
        .style(
            "display",
            "block"
        );


    moveTooltip(event);
}


function moveTooltip(event) {

    d3.select(
        "#d3-tooltip"
    )
        .style(
            "left",
            `${event.pageX + 14}px`
        )
        .style(
            "top",
            `${event.pageY + 14}px`
        );
}


function hideTooltip() {

    d3.select(
        "#d3-tooltip"
    )
        .style(
            "display",
            "none"
        );
}


// ============================================================
// RESPONSIVE REDRAW
// ============================================================

let resizeTimer = null;

window.addEventListener(
    "resize",
    () => {

        clearTimeout(
            resizeTimer
        );

        resizeTimer = setTimeout(
            () => {

                if (allData.length) {
                    updateDashboard();
                }

            },
            150
        );
    }
);
