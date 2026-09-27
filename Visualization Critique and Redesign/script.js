// ============================================================
// 1. GLOBAL VARIABLES
// ============================================================

let allData = [];
let filteredData = [];

let selectedGenre = null;

const margin = {
    top: 40,
    right: 30,
    bottom: 55,
    left: 65
};


// ============================================================
// 2. LOAD DATA
// ============================================================

d3.csv("data/netflix.csv").then(data => {

    // --------------------------------------------------------
    // Parse data
    // --------------------------------------------------------

    data.forEach(d => {

        d.release_year = +d.release_year;
        d.runtime = +d.runtime;
        d.seasons = +d.seasons;
        d.imdb_score = +d.imdb_score;
        d.imdb_votes = +d.imdb_votes;

        // Clean strings
        d.type = d.type ? d.type.trim() : "";
        d.genre = d.genre ? d.genre.trim() : "";
        d.country = d.country ? d.country.trim() : "";
        d.age_certification = d.age_certification
            ? d.age_certification.trim()
            : "Unknown";

    });

    // Remove rows without a valid release year
    allData = data.filter(d =>
        !isNaN(d.release_year) &&
        d.release_year > 0
    );

    filteredData = allData;

    console.log("Netflix data loaded:", allData);
    console.log("Number of titles:", allData.length);

    // --------------------------------------------------------
    // Initialize controls
    // --------------------------------------------------------

    initializeFilters();

    // --------------------------------------------------------
    // Initial visualization
    // --------------------------------------------------------

    updateDashboard();

}).catch(error => {

    console.error("Error loading Netflix CSV:", error);

});


// ============================================================
// 3. INITIALIZE FILTERS
// ============================================================

function initializeFilters() {

    const typeFilter = d3.select("#type-filter");
    const yearStart = d3.select("#year-start");
    const yearEnd = d3.select("#year-end");

    const minYear = d3.min(allData, d => d.release_year);
    const maxYear = d3.max(allData, d => d.release_year);

    // Set year input limits
    yearStart
        .attr("min", minYear)
        .attr("max", maxYear)
        .property("value", minYear);

    yearEnd
        .attr("min", minYear)
        .attr("max", maxYear)
        .property("value", maxYear);

    // Type filter
    typeFilter.on("change", function () {
        selectedGenre = null;
        updateDashboard();
    });

    // Year filters
    yearStart.on("change", function () {
        selectedGenre = null;
        updateDashboard();
    });

    yearEnd.on("change", function () {
        selectedGenre = null;
        updateDashboard();
    });

    // Reset button
    d3.select("#reset-button")
        .on("click", function () {

            typeFilter.property("value", "All");
            yearStart.property("value", minYear);
            yearEnd.property("value", maxYear);

            selectedGenre = null;

            updateDashboard();
        });
}


// ============================================================
// 4. UPDATE ENTIRE DASHBOARD
// ============================================================

function updateDashboard() {

    const type = d3.select("#type-filter").property("value");

    let startYear = +d3.select("#year-start").property("value");
    let endYear = +d3.select("#year-end").property("value");

    // Prevent invalid range
    if (startYear > endYear) {
        const temp = startYear;
        startYear = endYear;
        endYear = temp;

        d3.select("#year-start").property("value", startYear);
        d3.select("#year-end").property("value", endYear);
    }

    // --------------------------------------------------------
    // Filter data
    // --------------------------------------------------------

    filteredData = allData.filter(d => {

        const typeMatch =
            type === "All" ||
            d.type === type;

        const yearMatch =
            d.release_year >= startYear &&
            d.release_year <= endYear;

        return typeMatch && yearMatch;
    });

    console.log("Filtered data:", filteredData);

    // --------------------------------------------------------
    // Update everything
    // --------------------------------------------------------

    updateKPIs(filteredData);
    updateTimeChart(filteredData);
    updateGenreChart(filteredData);
    updateRatingChart(filteredData);
    updateCountryChart(filteredData);
}


// ============================================================
// 5. KPI CARDS
// ============================================================

function updateKPIs(data) {

    const totalTitles = data.length;

    const totalMovies = data.filter(d =>
        d.type === "Movie"
    ).length;

    const totalShows = data.filter(d =>
        d.type === "Show"
    ).length;

    const validScores = data
        .map(d => d.imdb_score)
        .filter(d => !isNaN(d) && d > 0);

    const averageScore = validScores.length > 0
        ? d3.mean(validScores)
        : null;

    d3.select("#total-titles")
        .text(d3.format(",")(totalTitles));

    d3.select("#total-movies")
        .text(d3.format(",")(totalMovies));

    d3.select("#total-shows")
        .text(d3.format(",")(totalShows));

    d3.select("#avg-score")
        .text(
            averageScore !== null
                ? averageScore.toFixed(2)
                : "N/A"
        );
}


// ============================================================
// 6. TIME SERIES
// ============================================================

function updateTimeChart(data) {

    const container = d3.select("#time-chart");

    container.selectAll("*").remove();

    if (data.length === 0) {
        container
            .append("p")
            .attr("class", "no-data")
            .text("No data available for the selected filters.");

        return;
    }

    // --------------------------------------------------------
    // Container size
    // --------------------------------------------------------

    const containerNode = container.node();

    const width = Math.max(
        containerNode.getBoundingClientRect().width,
        500
    );

    const height = 400;

    const innerWidth =
        width - margin.left - margin.right;

    const innerHeight =
        height - margin.top - margin.bottom;


    // --------------------------------------------------------
    // Yearly counts
    // --------------------------------------------------------

    const years = d3.range(
        d3.min(data, d => d.release_year),
        d3.max(data, d => d.release_year) + 1
    );

    const movieCounts = new Map(
        d3.rollups(
            data.filter(d => d.type === "Movie"),
            v => v.length,
            d => d.release_year
        )
    );

    const showCounts = new Map(
        d3.rollups(
            data.filter(d => d.type === "Show"),
            v => v.length,
            d => d.release_year
        )
    );

    const movieData = years.map(year => ({
        year: year,
        count: movieCounts.get(year) || 0
    }));

    const showData = years.map(year => ({
        year: year,
        count: showCounts.get(year) || 0
    }));


    // --------------------------------------------------------
    // SVG
    // --------------------------------------------------------

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    // --------------------------------------------------------
    // Scales
    // --------------------------------------------------------

    const x = d3.scaleLinear()
        .domain([
            d3.min(years),
            d3.max(years)
        ])
        .range([0, innerWidth]);

    const maxCount = d3.max([
        d3.max(movieData, d => d.count),
        d3.max(showData, d => d.count)
    ]);

    const y = d3.scaleLinear()
        .domain([0, maxCount])
        .nice()
        .range([innerHeight, 0]);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    const xAxis = d3.axisBottom(x)
        .tickFormat(d3.format("d"))
        .ticks(Math.min(years.length, 10));

    const yAxis = d3.axisLeft(y)
        .ticks(6);

    g.append("g")
        .attr("class", "x-axis")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(xAxis);

    g.append("g")
        .attr("class", "y-axis")
        .call(yAxis);


    // --------------------------------------------------------
    // Grid lines
    // --------------------------------------------------------

    g.append("g")
        .attr("class", "grid")
        .call(
            d3.axisLeft(y)
                .ticks(6)
                .tickSize(-innerWidth)
                .tickFormat("")
        );


    // --------------------------------------------------------
    // Line generator
    // --------------------------------------------------------

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count))
        .curve(d3.curveMonotoneX);


    // --------------------------------------------------------
    // Movie line
    // --------------------------------------------------------

    g.append("path")
        .datum(movieData)
        .attr("class", "line movie-line")
        .attr("fill", "none")
        .attr("d", line);


    // --------------------------------------------------------
    // Show line
    // --------------------------------------------------------

    g.append("path")
        .datum(showData)
        .attr("class", "line show-line")
        .attr("fill", "none")
        .attr("d", line);


    // --------------------------------------------------------
    // Data points
    // --------------------------------------------------------

    addTimePoints(
        g,
        movieData,
        x,
        y,
        "Movie"
    );

    addTimePoints(
        g,
        showData,
        x,
        y,
        "TV Show"
    );


    // --------------------------------------------------------
    // Axis labels
    // --------------------------------------------------------

    g.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 45)
        .attr("text-anchor", "middle")
        .text("Release Year");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .text("Number of Titles");


    // --------------------------------------------------------
    // Legend
    // --------------------------------------------------------

    addLineLegend(
        svg,
        width,
        "Movie",
        "movie-line"
    );

    addLineLegend(
        svg,
        width,
        "TV Show",
        "show-line",
        80
    );
}


// ============================================================
// 7. TIME SERIES POINTS + TOOLTIP
// ============================================================

function addTimePoints(
    g,
    data,
    x,
    y,
    type
) {

    g.selectAll(`.point-${type.replace(" ", "-")}`)
        .data(data)
        .enter()
        .append("circle")
        .attr(
            "class",
            `time-point point-${type.replace(" ", "-")}`
        )
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.count))
        .attr("r", 3)
        .on("mouseover", function (event, d) {

            showTooltip(
                event,
                `<strong>${type}</strong><br>
                 Year: ${d.year}<br>
                 Titles: ${d3.format(",")(d.count)}`
            );

            d3.select(this)
                .attr("r", 6);

        })
        .on("mousemove", function (event) {

            moveTooltip(event);

        })
        .on("mouseout", function () {

            hideTooltip();

            d3.select(this)
                .attr("r", 3);
        });
}


// ============================================================
// 8. LINE LEGEND
// ============================================================

function addLineLegend(
    svg,
    width,
    label,
    className,
    offset = 0
) {

    const legend = svg
        .append("g")
        .attr(
            "transform",
            `translate(${width - 150},${20 + offset})`
        );

    legend.append("line")
        .attr("class", className)
        .attr("x1", 0)
        .attr("x2", 25)
        .attr("y1", 0)
        .attr("y2", 0);

    legend.append("text")
        .attr("x", 35)
        .attr("y", 5)
        .text(label);
}


// ============================================================
// 9. GENRE DATA
// ============================================================

function getGenreData(data) {

    const counts = new Map();

    data.forEach(d => {

        if (!d.genre) return;

        const genres = d.genre
            .split(",")
            .map(g => g.trim())
            .filter(g => g !== "");

        genres.forEach(genre => {

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
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}


// ============================================================
// 10. GENRE BAR CHART
// ============================================================

function updateGenreChart(data) {

    const container = d3.select("#genre-chart");

    container.selectAll("*").remove();

    const genreData = getGenreData(data);

    if (genreData.length === 0) {

        container
            .append("p")
            .text("No genre data available.");

        return;
    }

    const containerNode = container.node();

    const width = Math.max(
        containerNode.getBoundingClientRect().width,
        400
    );

    const height = 420;

    const innerWidth =
        width - margin.left - margin.right;

    const innerHeight =
        height - margin.top - margin.bottom;


    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    // --------------------------------------------------------
    // Scales
    // --------------------------------------------------------

    const x = d3.scaleLinear()
        .domain([
            0,
            d3.max(genreData, d => d.count)
        ])
        .nice()
        .range([0, innerWidth]);

    const y = d3.scaleBand()
        .domain(
            genreData.map(d => d.genre)
        )
        .range([0, innerHeight])
        .padding(0.25);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    g.append("g")
        .attr("class", "x-axis")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(
            d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d3.format("d"))
        );

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));


    // --------------------------------------------------------
    // Bars
    // --------------------------------------------------------

    g.selectAll(".genre-bar")
        .data(genreData)
        .enter()
        .append("rect")
        .attr("class", "genre-bar")
        .attr("x", 0)
        .attr("y", d => y(d.genre))
        .attr("width", d => x(d.count))
        .attr("height", y.bandwidth())
        .classed(
            "selected",
            d => selectedGenre === d.genre
        )
        .on("mouseover", function (event, d) {

            showTooltip(
                event,
                `<strong>${d.genre}</strong><br>
                 Titles: ${d3.format(",")(d.count)}`
            );

        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)

        // Click to highlight
        .on("click", function (event, d) {

            if (selectedGenre === d.genre) {
                selectedGenre = null;
            } else {
                selectedGenre = d.genre;
            }

            updateGenreChart(data);
        });


    // --------------------------------------------------------
    // Values
    // --------------------------------------------------------

    g.selectAll(".genre-value")
        .data(genreData)
        .enter()
        .append("text")
        .attr("class", "bar-value")
        .attr("x", d => x(d.count) + 6)
        .attr(
            "y",
            d => y(d.genre) + y.bandwidth() / 2
        )
        .attr("dominant-baseline", "middle")
        .text(d => d3.format(",")(d.count));
}


// ============================================================
// 11. AGE CERTIFICATION
// ============================================================

function updateRatingChart(data) {

    const container = d3.select("#rating-chart");

    container.selectAll("*").remove();

    const ratingCounts = d3.rollups(
        data,
        v => v.length,
        d => d.age_certification || "Unknown"
    )
    .map(([rating, count]) => ({
        rating,
        count
    }))
    .sort((a, b) => b.count - a.count);


    if (ratingCounts.length === 0) {

        container
            .append("p")
            .text("No certification data available.");

        return;
    }


    const containerNode = container.node();

    const width = Math.max(
        containerNode.getBoundingClientRect().width,
        400
    );

    const height = 420;

    const innerWidth =
        width - margin.left - margin.right;

    const innerHeight =
        height - margin.top - margin.bottom;


    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    // --------------------------------------------------------
    // Scales
    // --------------------------------------------------------

    const x = d3.scaleBand()
        .domain(
            ratingCounts.map(d => d.rating)
        )
        .range([0, innerWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(ratingCounts, d => d.count)
        ])
        .nice()
        .range([innerHeight, 0]);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    g.append("g")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .attr("class", "x-axis")
        .call(d3.axisBottom(x));

    g.append("g")
        .attr("class", "y-axis")
        .call(
            d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d3.format("d"))
        );


    // --------------------------------------------------------
    // Bars
    // --------------------------------------------------------

    g.selectAll(".rating-bar")
        .data(ratingCounts)
        .enter()
        .append("rect")
        .attr("class", "rating-bar")
        .attr("x", d => x(d.rating))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr(
            "height",
            d => innerHeight - y(d.count)
        )
        .on("mouseover", function (event, d) {

            showTooltip(
                event,
                `<strong>${d.rating}</strong><br>
                 Titles: ${d3.format(",")(d.count)}`
            );

        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);


    // --------------------------------------------------------
    // Values
    // --------------------------------------------------------

    g.selectAll(".rating-value")
        .data(ratingCounts)
        .enter()
        .append("text")
        .attr("class", "bar-value")
        .attr(
            "x",
            d => x(d.rating) + x.bandwidth() / 2
        )
        .attr(
            "y",
            d => y(d.count) - 7
        )
        .attr("text-anchor", "middle")
        .text(d => d3.format(",")(d.count));
}


// ============================================================
// 12. COUNTRY DATA
// ============================================================

function getCountryData(data) {

    const counts = new Map();

    data.forEach(d => {

        if (!d.country) return;

        /*
         * Some datasets may contain multiple countries
         * separated by commas.
         */
        const countries = d.country
            .split(",")
            .map(c => c.trim())
            .filter(c => c !== "");

        countries.forEach(country => {

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
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}


// ============================================================
// 13. COUNTRY BAR CHART
// ============================================================

function updateCountryChart(data) {

    const container = d3.select("#country-chart");

    container.selectAll("*").remove();

    const countryData = getCountryData(data);

    if (countryData.length === 0) {

        container
            .append("p")
            .text("No country data available.");

        return;
    }


    const containerNode = container.node();

    const width = Math.max(
        containerNode.getBoundingClientRect().width,
        400
    );

    const height = 420;

    const innerWidth =
        width - margin.left - margin.right;

    const innerHeight =
        height - margin.top - margin.bottom;


    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );


    // --------------------------------------------------------
    // Scales
    // --------------------------------------------------------

    const x = d3.scaleLinear()
        .domain([
            0,
            d3.max(countryData, d => d.count)
        ])
        .nice()
        .range([0, innerWidth]);

    const y = d3.scaleBand()
        .domain(
            countryData.map(d => d.country)
        )
        .range([0, innerHeight])
        .padding(0.25);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    g.append("g")
        .attr("class", "x-axis")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(
            d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d3.format("d"))
        );

    g.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));


    // --------------------------------------------------------
    // Bars
    // --------------------------------------------------------

    g.selectAll(".country-bar")
        .data(countryData)
        .enter()
        .append("rect")
        .attr("class", "country-bar")
        .attr("x", 0)
        .attr("y", d => y(d.country))
        .attr("width", d => x(d.count))
        .attr("height", y.bandwidth())
        .on("mouseover", function (event, d) {

            showTooltip(
                event,
                `<strong>${d.country}</strong><br>
                 Titles: ${d3.format(",")(d.count)}`
            );

        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);


    // --------------------------------------------------------
    // Values
    // --------------------------------------------------------

    g.selectAll(".country-value")
        .data(countryData)
        .enter()
        .append("text")
        .attr("class", "bar-value")
        .attr("x", d => x(d.count) + 6)
        .attr(
            "y",
            d => y(d.country) + y.bandwidth() / 2
        )
        .attr("dominant-baseline", "middle")
        .text(d => d3.format(",")(d.count));
}


// ============================================================
// 14. TOOLTIP
// ============================================================

function showTooltip(event, html) {

    let tooltip = d3.select("#d3-tooltip");

    // Create tooltip if it does not exist
    if (tooltip.empty()) {

        tooltip = d3.select("body")
            .append("div")
            .attr("id", "d3-tooltip")
            .attr("class", "d3-tooltip");
    }

    tooltip
        .html(html)
        .style("display", "block")
        .style(
            "left",
            `${event.pageX + 12}px`
        )
        .style(
            "top",
            `${event.pageY + 12}px`
        );
}


function moveTooltip(event) {

    d3.select("#d3-tooltip")
        .style(
            "left",
            `${event.pageX + 12}px`
        )
        .style(
            "top",
            `${event.pageY + 12}px`
        );
}


function hideTooltip() {

    d3.select("#d3-tooltip")
        .style("display", "none");
}


// ============================================================
// 15. RESPONSIVE REDRAW
// ============================================================

window.addEventListener("resize", function () {

    if (allData.length > 0) {
        updateDashboard();
    }

});
