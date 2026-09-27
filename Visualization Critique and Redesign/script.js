// ============================================================
// NETFLIX VISUALIZATION CRITIQUE & REDESIGN
// ============================================================

const DATA_PATH = "../data/netflix.csv";

let allData = [];
let filteredData = [];
let selectedYear = null;
let selectedCategory = null;


// ============================================================
// 1. LOAD DATA
// ============================================================

d3.csv(DATA_PATH)
    .then(data => {

        allData = data
            .map(d => ({
                id: d.id || "",
                title: d.title || "",
                type: normalizeType(d.type),
                release_year: +d.release_year,

                age_certification:
                    d.age_certification || "Unknown",

                runtime: +d.runtime || 0,
                seasons: +d.seasons || 0,
                imdb_score: +d.imdb_score || 0,
                imdb_votes: +d.imdb_votes || 0,

                country: d.country || "Unknown",
                genre: d.genre || ""
            }))
            .filter(d =>
                Number.isFinite(d.release_year)
            );


        console.log(
            `Loaded ${allData.length} Netflix titles.`
        );


        initializeControls();
        updateDashboard();

    })
    .catch(error => {

        console.error(
            "Could not load Netflix data:",
            error
        );


        const container =
            document.querySelector("#time-chart");


        if (container) {

            container.innerHTML = `
                <div style="
                    padding: 30px;
                    color: #e50914;
                    font-size: 15px;
                ">
                    Could not load data/netflix.csv.
                    Please check the file path.
                </div>
            `;
        }
    });


// ============================================================
// 2. NORMALIZE TYPE
// ============================================================

function normalizeType(value) {

    if (!value) return "Unknown";

    const text =
        String(value)
            .trim()
            .toLowerCase();


    if (
        text === "movie" ||
        text === "movies"
    ) {
        return "Movie";
    }


    if (
        text === "show" ||
        text === "tv show" ||
        text === "tv_show" ||
        text === "series"
    ) {
        return "Show";
    }


    return value;
}


// ============================================================
// 3. INITIALIZE CONTROLS
// ============================================================

function initializeControls() {

    const typeFilter =
        document.querySelector("#type-filter");


    if (typeFilter) {

        typeFilter.addEventListener(
            "change",
            updateDashboard
        );
    }


    const resetButton =
        document.querySelector("#reset-button");


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetFilters
        );
    }


    const sliders =
        getYearSliders();


    sliders.forEach(slider => {

        slider.addEventListener(
            "input",
            function () {

                enforceYearOrder(slider);
                updateYearLabels();
                updateDashboard();

            }
        );

    });


    initializeSliderValues();
    updateYearLabels();
}


// ============================================================
// 4. FIND YEAR SLIDERS
// ============================================================

function getYearSliders() {

    return Array.from(
        document.querySelectorAll(
            'input[type="range"]'
        )
    );
}


// ============================================================
// 5. INITIALIZE YEAR SLIDERS
// ============================================================

function initializeSliderValues() {

    if (!allData.length) return;


    const minYear =
        d3.min(
            allData,
            d => d.release_year
        );


    const maxYear =
        d3.max(
            allData,
            d => d.release_year
        );


    const sliders =
        getYearSliders();


    if (sliders.length >= 1) {

        sliders[0].min = minYear;
        sliders[0].max = maxYear;

        if (
            !sliders[0].value ||
            +sliders[0].value < minYear ||
            +sliders[0].value > maxYear
        ) {
            sliders[0].value = minYear;
        }
    }


    if (sliders.length >= 2) {

        sliders[1].min = minYear;
        sliders[1].max = maxYear;

        if (
            !sliders[1].value ||
            +sliders[1].value < minYear ||
            +sliders[1].value > maxYear
        ) {
            sliders[1].value = maxYear;
        }
    }
}


// ============================================================
// 6. GET START YEAR
// ============================================================

function getStartYear() {

    const sliders =
        getYearSliders();


    if (sliders.length >= 1) {

        return +sliders[0].value;
    }


    return d3.min(
        allData,
        d => d.release_year
    );
}


// ============================================================
// 7. GET END YEAR
// ============================================================

function getEndYear() {

    const sliders =
        getYearSliders();


    if (sliders.length >= 2) {

        return +sliders[1].value;
    }


    return d3.max(
        allData,
        d => d.release_year
    );
}


// ============================================================
// 8. ENFORCE YEAR ORDER
// ============================================================

function enforceYearOrder(activeSlider) {

    const sliders =
        getYearSliders();


    if (sliders.length < 2) {
        return;
    }


    const startSlider =
        sliders[0];

    const endSlider =
        sliders[1];


    let start =
        +startSlider.value;

    let end =
        +endSlider.value;


    if (start > end) {

        if (activeSlider === startSlider) {

            endSlider.value = start;

        } else {

            startSlider.value = end;
        }
    }
}


// ============================================================
// 9. UPDATE YEAR LABELS
// ============================================================

function updateYearLabels() {

    const sliders =
        getYearSliders();


    if (sliders.length < 2) {
        return;
    }


    const start =
        document.querySelector(
            "#start-year-value"
        );

    const end =
        document.querySelector(
            "#end-year-value"
        );


    if (start) {
        start.textContent =
            sliders[0].value;
    }


    if (end) {
        end.textContent =
            sliders[1].value;
    }
}


// ============================================================
// 10. RESET
// ============================================================

function resetFilters() {

    const minYear =
        d3.min(
            allData,
            d => d.release_year
        );


    const maxYear =
        d3.max(
            allData,
            d => d.release_year
        );


    const sliders =
        getYearSliders();


    if (sliders.length >= 1) {
        sliders[0].value = minYear;
    }


    if (sliders.length >= 2) {
        sliders[1].value = maxYear;
    }


    const typeFilter =
        document.querySelector(
            "#type-filter"
        );


    if (typeFilter) {
        typeFilter.value = "All";
    }


    clearSelection();
    updateYearLabels();
    updateDashboard();
}


// ============================================================
// 11. MAIN UPDATE
// ============================================================

function updateDashboard() {

    if (!allData.length) {
        return;
    }


    clearSelection();


    const typeFilter =
        document.querySelector(
            "#type-filter"
        );


    const selectedType =
        typeFilter
            ? typeFilter.value
            : "All";


    const startYear =
        Math.min(
            getStartYear(),
            getEndYear()
        );


    const endYear =
        Math.max(
            getStartYear(),
            getEndYear()
        );


    filteredData =
        allData.filter(d => {

            const typeMatch =
                selectedType === "All" ||
                selectedType === "" ||
                d.type === selectedType;


            const yearMatch =
                d.release_year >= startYear &&
                d.release_year <= endYear;


            return typeMatch && yearMatch;
        });


    drawTimeChart(
        filteredData,
        startYear,
        endYear
    );


    drawGenreChart(
        filteredData
    );


    drawRatingChart(
        filteredData
    );


    drawCountryChart(
        filteredData
    );


    updateYearLabels();
}


// ============================================================
// 12. CLEAR CONTAINER
// ============================================================

function clearContainer(selector) {

    const container =
        d3.select(selector);


    if (container.empty()) {

        console.warn(
            `Missing visualization container: ${selector}`
        );

        return null;
    }


    container.selectAll("*").remove();

    return container;
}


// ============================================================
// 13. TIME SERIES CHART
// ============================================================

function drawTimeChart(
    data,
    startYear,
    endYear
) {

    const container =
        clearContainer(
            "#time-chart"
        );


    if (!container) {
        return;
    }


    if (!data.length) {

        container
            .append("div")
            .style(
                "padding",
                "40px 10px"
            )
            .style(
                "color",
                "rgba(255,255,255,0.5)"
            )
            .text(
                "No data available for this selection."
            );

        return;
    }


    const node =
        container.node();


    const width =
        node.clientWidth || 800;


    const height =
        390;


    const margin = {
        top: 20,
        right: 30,
        bottom: 45,
        left: 55
    };


    const innerWidth =
        width -
        margin.left -
        margin.right;


    const innerHeight =
        height -
        margin.top -
        margin.bottom;


    const svg =
        container
            .append("svg")
            .attr(
                "width",
                "100%"
            )
            .attr(
                "height",
                height
            )
            .attr(
                "viewBox",
                `0 0 ${width} ${height}`
            );


    const chart =
        svg
            .append("g")
            .attr(
                "transform",
                `translate(${margin.left},${margin.top})`
            );


    const movieData =
        d3.rollup(
            data.filter(
                d => d.type === "Movie"
            ),
            values => values.length,
            d => d.release_year
        );


    const showData =
        d3.rollup(
            data.filter(
                d => d.type === "Show"
            ),
            values => values.length,
            d => d.release_year
        );


    const years =
        d3.range(
            startYear,
            endYear + 1
        );


    const movieSeries =
        years.map(year => ({
            year,
            value:
                movieData.get(year) || 0
        }));


    const showSeries =
        years.map(year => ({
            year,
            value:
                showData.get(year) || 0
        }));


    const movieDataFinal =
        movieSeries.filter(
            d => d.value > 0
        );


    const showDataFinal =
        showSeries.filter(
            d => d.value > 0
        );


    const movieDataToUse =
        movieDataFinal.length
            ? movieDataFinal
            : movieSeries;


    const showDataToUse =
        showDataFinal.length
            ? showDataFinal
            : showSeries;


    const combined =
        movieDataToUse.concat(
            showDataToUse
        );


    const maxValue =
        d3.max(
            combined,
            d => d.value
        ) || 1;


    const x =
        d3.scaleLinear()
            .domain([
                startYear,
                endYear
            ])
            .range([
                0,
                innerWidth
            ]);


    const y =
        d3.scaleLinear()
            .domain([
                0,
                maxValue
            ])
            .nice()
            .range([
                innerHeight,
                0
            ]);


    chart
        .append("g")
        .attr(
            "class",
            "grid"
        )
        .call(
            d3.axisLeft(y)
                .ticks(6)
                .tickSize(
                    -innerWidth
                )
                .tickFormat("")
        );


    chart
        .append("g")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(
            d3.axisBottom(x)
                .ticks(
                    Math.min(
                        10,
                        Math.max(
                            2,
                            years.length
                        )
                    )
                )
                .tickFormat(
                    d3.format("d")
                )
        );


    chart
        .append("g")
        .call(
            d3.axisLeft(y)
                .ticks(6)
        );


    const line =
        d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .curve(
                d3.curveMonotoneX
            );


    const moviePath =
        chart
            .append("path")
            .datum(
                movieDataToUse
            )
            .attr(
                "class",
                "netflix-line movie-line"
            )
            .attr(
                "d",
                line
            )
            .attr(
                "fill",
                "none"
            )
            .attr(
                "stroke",
                "#e50914"
            );


    const showPath =
        chart
            .append("path")
            .datum(
                showDataToUse
            )
            .attr(
                "class",
                "netflix-line show-line"
            )
            .attr(
                "d",
                line
            )
            .attr(
                "fill",
                "none"
            )
            .attr(
                "stroke",
                "#5bc0eb"
            );


    animatePath(moviePath);
    animatePath(showPath);


    addTimePoints(
        chart,
        movieDataToUse,
        x,
        y,
        "#e50914"
    );


    addTimePoints(
        chart,
        showDataToUse,
        x,
        y,
        "#5bc0eb"
    );


    const legend =
        d3.select(
            "#time-legend"
        );


    if (!legend.empty()) {

        legend.html(`
            <span class="legend-item">
                <span
                    class="legend-dot movie-dot"
                ></span>
                Movies
            </span>

            <span class="legend-item">
                <span
                    class="legend-dot show-dot"
                ></span>
                TV Shows
            </span>
        `);
    }
}


// ============================================================
// 14. ANIMATE LINE
// ============================================================

function animatePath(path) {

    const node =
        path.node();


    if (!node) {
        return;
    }


    const length =
        node.getTotalLength();


    path
        .attr(
            "stroke-dasharray",
            `${length} ${length}`
        )
        .attr(
            "stroke-dashoffset",
            length
        )
        .transition()
        .duration(900)
        .ease(
            d3.easeCubicOut
        )
        .attr(
            "stroke-dashoffset",
            0
        );
}


// ============================================================
// 15. TIME-SERIES POINTS
// ============================================================

function addTimePoints(
    chart,
    data,
    x,
    y,
    color
) {

    const tooltip =
        getTooltip();


    chart
        .selectAll(
            `.point-${color.replace("#", "")}`
        )
        .data(data)
        .enter()
        .append("circle")
        .attr(
            "class",
            `data-point ${
                color === "#e50914"
                    ? "movie-point"
                    : "show-point"
            }`
        )
        .attr(
            "cx",
            d => x(d.year)
        )
        .attr(
            "cy",
            d => y(d.value)
        )
        .attr(
            "r",
            4
        )
        .attr(
            "fill",
            color
        )
        .attr(
            "stroke",
            "#111111"
        )
        .attr(
            "stroke-width",
            1.5
        )
        .style(
            "cursor",
            "pointer"
        )
        .on(
            "mouseenter",
            function(event, d) {

                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr(
                        "r",
                        6
                    );


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <strong>
                            ${d.type}
                        </strong>
                        <br>
                        Year: ${d.year}
                        <br>
                        Titles:
                        ${d.value.toLocaleString()}
                    `);
            }
        )
        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 14}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 35}px`
                    );
            }
        )
        .on(
            "mouseleave",
            function(event, d) {

                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr(
                        "r",
                        selectedYear === d.year
                            ? 7
                            : 4
                    );


                tooltip
                    .style(
                        "opacity",
                        0
                    );
            }
        )
        .on(
            "click",
            function(event, d) {

                event.stopPropagation();

                setSelectedYear(
                    d.year
                );
            }
        );
}


// ============================================================
// 16. SELECTION / LINKED INTERACTION
// ============================================================

function setSelectedYear(year) {

    selectedYear =
        selectedYear === year
            ? null
            : year;


    d3.selectAll(
        ".data-point"
    )
        .classed(
            "selected-point",
            d =>
                selectedYear !== null &&
                d.year === selectedYear
        )
        .classed(
            "dimmed-point",
            d =>
                selectedYear !== null &&
                d.year !== selectedYear
        );


    d3.selectAll(
        ".year-marker"
    ).remove();


    if (selectedYear === null) {
        return;
    }


    const chart =
        d3.select(
            "#time-chart svg g"
        );


    if (chart.empty()) {
        return;
    }


    const selected =
        chart
            .selectAll(
                ".data-point"
            )
            .filter(
                d =>
                    d.year === selectedYear
            );


    if (!selected.empty()) {

        const x =
            +selected.attr("cx");


        const svgHeight =
            +d3
                .select(
                    "#time-chart svg"
                )
                .attr("height") || 400;


        chart
            .append("line")
            .attr(
                "class",
                "year-marker"
            )
            .attr(
                "x1",
                x
            )
            .attr(
                "x2",
                x
            )
            .attr(
                "y1",
                0
            )
            .attr(
                "y2",
                Math.max(
                    0,
                    svgHeight - 55
                )
            )
            .attr(
                "stroke",
                "rgba(255,255,255,0.28)"
            )
            .attr(
                "stroke-width",
                1
            )
            .attr(
                "stroke-dasharray",
                "4 4"
            )
            .lower();
    }
}


function clearSelection() {

    selectedYear = null;
    selectedCategory = null;


    d3.selectAll(
        ".data-point"
    )
        .classed(
            "selected-point",
            false
        )
        .classed(
            "dimmed-point",
            false
        );


    d3.selectAll(
        ".bar"
    )
        .classed(
            "selected-bar",
            false
        )
        .classed(
            "dimmed-bar",
            false
        );


    d3.selectAll(
        ".year-marker"
    ).remove();
}


// Clicking empty chart space clears the current selection.
d3.select("body")
    .on(
        "click.chartSelection",
        function() {
            clearSelection();
        }
    );


// ============================================================
// 17. GENRE CHART
// ============================================================

function drawGenreChart(data) {

    const container =
        clearContainer(
            "#genre-chart"
        );


    if (!container) {
        return;
    }


    const counts =
        new Map();


    data.forEach(d => {

        if (!d.genre) {
            return;
        }


        const genres =
            d.genre
                .split(",")
                .map(
                    genre =>
                        genre.trim()
                )
                .filter(Boolean);


        genres.forEach(genre => {

            counts.set(
                genre,
                (
                    counts.get(genre) || 0
                ) + 1
            );

        });

    });


    const genreData =
        Array.from(
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
        .slice(
            0,
            10
        );


    drawHorizontalBars(
        container,
        genreData,
        "genre",
        "count",
        390
    );
}


// ============================================================
// 18. CERTIFICATION CHART
// ============================================================

function drawRatingChart(data) {

    const container =
        clearContainer(
            "#rating-chart"
        );


    if (!container) {
        return;
    }


    const counts =
        d3.rollup(
            data,
            values => values.length,
            d =>
                d.age_certification ||
                "Unknown"
        );


    const ratingData =
        Array.from(
            counts,
            ([rating, count]) => ({
                rating,
                count
            })
        )
        .sort(
            (a, b) =>
                b.count - a.count
        );


    drawHorizontalBars(
        container,
        ratingData,
        "rating",
        "count",
        350
    );
}


// ============================================================
// 19. COUNTRY CHART
// ============================================================

function drawCountryChart(data) {

    const container =
        clearContainer(
            "#country-chart"
        );


    if (!container) {
        return;
    }


    const counts =
        new Map();


    data.forEach(d => {

        if (!d.country) {
            return;
        }


        const countries =
            d.country
                .split(",")
                .map(
                    country =>
                        country.trim()
                )
                .filter(Boolean);


        countries.forEach(country => {

            counts.set(
                country,
                (
                    counts.get(country) || 0
                ) + 1
            );

        });

    });


    const countryData =
        Array.from(
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
        .slice(
            0,
            10
        );


    drawHorizontalBars(
        container,
        countryData,
        "country",
        "count",
        390
    );
}


// ============================================================
// 20. GENERIC HORIZONTAL BAR CHART
// ============================================================

function drawHorizontalBars(
    container,
    data,
    categoryKey,
    valueKey,
    height
) {

    if (!data.length) {

        container
            .append("div")
            .style(
                "padding",
                "40px 10px"
            )
            .style(
                "color",
                "rgba(255,255,255,0.5)"
            )
            .text(
                "No data available for this selection."
            );

        return;
    }


    const node =
        container.node();


    const width =
        node.clientWidth || 500;


    const margin = {
        top: 10,
        right: 35,
        bottom: 25,
        left: 105
    };


    const svg =
        container
            .append("svg")
            .attr(
                "width",
                "100%"
            )
            .attr(
                "height",
                height
            )
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
        svg
            .append("g")
            .attr(
                "transform",
                `translate(${margin.left},${margin.top})`
            );


    const y =
        d3.scaleBand()
            .domain(
                data.map(
                    d =>
                        d[categoryKey]
                )
            )
            .range([
                0,
                innerHeight
            ])
            .padding(0.22);


    const maxValue =
        d3.max(
            data,
            d => d[valueKey]
        ) || 1;


    const x =
        d3.scaleLinear()
            .domain([
                0,
                maxValue
            ])
            .nice()
            .range([
                0,
                innerWidth
            ]);


    chart
        .append("g")
        .attr(
            "class",
            "grid"
        )
        .call(
            d3.axisBottom(x)
                .ticks(4)
                .tickSize(
                    innerHeight
                )
                .tickFormat("")
        );


    chart
        .append("g")
        .call(
            d3.axisLeft(y)
        );


    const tooltip =
        getTooltip();


    chart
        .selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr(
            "class",
            "bar"
        )
        .attr(
            "x",
            0
        )
        .attr(
            "y",
            d =>
                y(
                    d[categoryKey]
                )
        )
        .attr(
            "height",
            y.bandwidth()
        )
        .attr(
            "width",
            0
        )
        .attr(
            "fill",
            "#e50914"
        )
        .attr(
            "rx",
            3
        )
        .on(
            "mouseenter",
            function(event, d) {

                d3.select(this)
                    .attr(
                        "fill",
                        "#ff5360"
                    )
                    .attr(
                        "opacity",
                        1
                    );


                tooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <strong>
                            ${d[categoryKey]}
                        </strong>
                        <br>
                        Titles:
                        ${d[valueKey].toLocaleString()}
                    `);
            }
        )
        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 14}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 35}px`
                    );
            }
        )
        .on(
            "mouseleave",
            function(event, d) {

                d3.select(this)
                    .attr(
                        "fill",
                        "#e50914"
                    )
                    .attr(
                        "opacity",
                        selectedCategory === d[categoryKey]
                            ? 1
                            : 0.82
                    );


                tooltip
                    .style(
                        "opacity",
                        0
                    );
            }
        )
        .on(
            "click",
            function(event, d) {

                event.stopPropagation();


                selectedCategory =
                    selectedCategory ===
                    d[categoryKey]
                        ? null
                        : d[categoryKey];


                d3.select(this.parentNode)
                    .selectAll(".bar")
                    .classed(
                        "selected-bar",
                        b =>
                            selectedCategory !== null &&
                            b[categoryKey] ===
                                selectedCategory
                    )
                    .classed(
                        "dimmed-bar",
                        b =>
                            selectedCategory !== null &&
                            b[categoryKey] !==
                                selectedCategory
                    );
            }
        )
        .transition()
        .duration(650)
        .ease(
            d3.easeCubicOut
        )
        .attr(
            "width",
            d =>
                x(
                    d[valueKey]
                )
        );
}


// ============================================================
// 21. TOOLTIP
// ============================================================

function getTooltip() {

    let tooltip =
        d3.select(
            "#tooltip"
        );


    if (tooltip.empty()) {

        tooltip =
            d3.select("body")
                .append("div")
                .attr(
                    "id",
                    "tooltip"
                );
    }


    return tooltip;
}


// ============================================================
// 22. RESPONSIVE REDRAW
// ============================================================

let resizeTimer = null;


window.addEventListener(
    "resize",
    function() {

        clearTimeout(
            resizeTimer
        );


        resizeTimer =
            setTimeout(
                function() {

                    if (
                        allData.length
                    ) {
                        updateDashboard();
                    }

                },
                200
            );
    }
);
