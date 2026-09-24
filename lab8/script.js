// ============================================================
// 1. GLOBAL VARIABLES
// ============================================================

let data = [];

let selectedPoint = null;

let selectedMatrixCell = null;

let svg;
let matrixSvg;

let points;

let xScale;
let yScale;

let width;
let height;

let matrixWidth;
let matrixHeight;


// ============================================================
// 2. LOAD CSV
// ============================================================

d3.csv("../data/lab8_embedding_map.csv", d => {

    return {
        ...d,

        x: +d.x,
        y: +d.y,
        word_count: +d.word_count,
        cluster: +d.cluster,
        page: +d.page
    };

}).then(loadedData => {

    data = loadedData;

    console.log("Loaded passages:", data.length);

    initialize();

});


// ============================================================
// 3. INITIALIZE
// ============================================================

function initialize() {

    createFilters();

    createSemanticMap();

    createMatrix();

    createLegend();

}


// ============================================================
// 4. FILTERS
// ============================================================

function createFilters() {

    const sections = Array.from(
        new Set(data.map(d => d.section))
    ).sort();

    const topics = Array.from(
        new Set(data.map(d => d.cluster_name))
    ).sort();


    const sectionSelect =
        d3.select("#section-filter");

    sections.forEach(section => {

        sectionSelect
            .append("option")
            .attr("value", section)
            .text(section);

    });


    const topicSelect =
        d3.select("#topic-filter");

    topics.forEach(topic => {

        topicSelect
            .append("option")
            .attr("value", topic)
            .text(topic);

    });


    sectionSelect.on("change", updateVisualization);

    topicSelect.on("change", updateVisualization);


    d3.select("#search")
        .on("input", updateVisualization);


    d3.select("#reset")
        .on("click", resetVisualization);
}


// ============================================================
// 5. SEMANTIC MAP
// ============================================================

function createSemanticMap() {

    svg = d3.select("#map");

    width =
        document.querySelector("#map")
        .getBoundingClientRect().width;

    height = 570;


    svg
        .attr("width", width)
        .attr("height", height);


    xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([50, width - 50]);


    yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.y))
        .range([height - 50, 50]);


    const color = d3.scaleOrdinal()
        .domain(
            data.map(d => d.cluster_name)
        )
        .range(d3.schemeTableau10);


    points = svg
        .selectAll(".point")
        .data(data)
        .join("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d =>
            Math.max(
                3,
                Math.min(10, Math.sqrt(d.word_count) / 2)
            )
        )
        .attr("fill", d => color(d.cluster_name))
        .on("click", function(event, d) {

            selectPoint(d);

        });


    // --------------------------------------------------------
    // Zoom / Pan
    // --------------------------------------------------------

    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on("zoom", event => {

            points.attr(
                "transform",
                event.transform
            );

        });


    svg.call(zoom);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .text("UMAP dimension 1");


    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .text("UMAP dimension 2");

}


// ============================================================
// 6. LEGEND
// ============================================================

function createLegend() {

    const container =
        d3.select("#legend");


    const topics = Array.from(
        new Set(data.map(d => d.cluster_name))
    );


    const color = d3.scaleOrdinal()
        .domain(topics)
        .range(d3.schemeTableau10);


    topics.forEach(topic => {

        const item =
            container
                .append("div")
                .attr("class", "legend-item");


        item.append("div")
            .attr("class", "legend-color")
            .style("background", color(topic));


        item.append("span")
            .text(topic);

    });

}


// ============================================================
// 7. UPDATE MAP
// ============================================================

function updateVisualization() {

    const search =
        d3.select("#search")
        .property("value")
        .toLowerCase()
        .trim();


    const selectedSection =
        d3.select("#section-filter")
        .property("value");


    const selectedTopic =
        d3.select("#topic-filter")
        .property("value");


    points
        .classed("dimmed", d => {

            const searchMatch =
                search === "" ||
                d.text.toLowerCase()
                    .includes(search);


            const sectionMatch =
                selectedSection === "all" ||
                d.section === selectedSection;


            const topicMatch =
                selectedTopic === "all" ||
                d.cluster_name === selectedTopic;


            return !(
                searchMatch &&
                sectionMatch &&
                topicMatch
            );

        });


    updateMatrixHighlight();

}


// ============================================================
// 8. SELECT POINT
// ============================================================

function selectPoint(d) {

    selectedPoint = d;


    points
        .classed("selected", p =>
            p.passage_id === d.passage_id
        );


    points
        .classed("neighbor", false);


    const neighbors =
        findNearestNeighbors(d, 5);


    neighbors.forEach(n => {

        points
            .filter(p =>
                p.passage_id === n.passage_id
            )
            .classed("neighbor", true);

    });


    showDetails(d, neighbors);

    highlightMatrixCell(d);

}


// ============================================================
// 9. FIND NEAREST NEIGHBORS
// ============================================================

function findNearestNeighbors(d, k) {

    return data
        .filter(p =>
            p.passage_id !== d.passage_id
        )
        .map(p => {

            const distance =
                Math.sqrt(
                    Math.pow(p.x - d.x, 2) +
                    Math.pow(p.y - d.y, 2)
                );

            return {
                ...p,
                distance: distance
            };

        })
        .sort((a, b) =>
            a.distance - b.distance
        )
        .slice(0, k);

}


// ============================================================
// 10. DETAILS PANEL
// ============================================================

function showDetails(d, neighbors) {

    const panel =
        d3.select("#detail-panel");


    panel.html(`

        <h3>${escapeHTML(d.section)}</h3>

        <div class="stat">
            <strong>Chapter</strong>
            ${escapeHTML(d.chapter || "N/A")}
        </div>

        <div class="stat">
            <strong>Section</strong>
            ${escapeHTML(d.section || "N/A")}
        </div>

        <div class="stat">
            <strong>Subsection</strong>
            ${escapeHTML(d.subsection || "N/A")}
        </div>

        <div class="stat">
            <strong>Page</strong>
            ${d.page}
        </div>

        <div class="stat">
            <strong>Semantic Topic</strong>
            ${escapeHTML(d.cluster_name || "N/A")}
        </div>

        <div class="stat">
            <strong>Word Count</strong>
            ${d.word_count}
        </div>

        <hr>

        <h3>Passage</h3>

        <p>
            ${escapeHTML(d.text)}
        </p>

        <hr>

        <h3>Nearest Semantic Passages</h3>

        <div id="neighbors"></div>

    `);


    const neighborContainer =
        d3.select("#neighbors");


    neighbors.forEach((n, i) => {

        neighborContainer
            .append("div")
            .attr("class", "neighbor-item")
            .html(`

                <strong>${i + 1}. ${escapeHTML(n.section)}</strong>

                <br>

                Page ${n.page}

                <br>

                ${escapeHTML(
                    n.text.substring(0, 180)
                )}...

            `);

    });

}


// ============================================================
// 11. MATRIX
// ============================================================

function createMatrix() {

    matrixSvg = d3.select("#matrix");


    matrixWidth =
        document.querySelector("#matrix")
        .getBoundingClientRect().width;

    matrixHeight = 500;


    matrixSvg
        .attr("width", matrixWidth)
        .attr("height", matrixHeight);


    const sections =
        Array.from(
            new Set(data.map(d => d.section))
        ).sort();


    const topics =
        Array.from(
            new Set(data.map(d => d.cluster_name))
        ).sort();


    const counts = {};


    data.forEach(d => {

        const key =
            `${d.section}|||${d.cluster_name}`;

        counts[key] =
            (counts[key] || 0) + 1;

    });


    const margin = {
        top: 120,
        right: 20,
        bottom: 50,
        left: 180
    };


    const innerWidth =
        matrixWidth -
        margin.left -
        margin.right;


    const innerHeight =
        matrixHeight -
        margin.top -
        margin.bottom;


    const x = d3.scaleBand()
        .domain(topics)
        .range([0, innerWidth])
        .padding(0.05);


    const y = d3.scaleBand()
        .domain(sections)
        .range([0, innerHeight])
        .padding(0.05);


    const maxCount =
        d3.max(Object.values(counts));


    const color =
        d3.scaleSequential(
            d3.interpolateBlues
        )
        .domain([0, maxCount]);


    const g =
        matrixSvg
            .append("g")
            .attr(
                "transform",
                `translate(${margin.left},${margin.top})`
            );


    const cells = [];


    sections.forEach(section => {

        topics.forEach(topic => {

            const count =
                counts[
                    `${section}|||${topic}`
                ] || 0;


            cells.push({
                section,
                topic,
                count
            });

        });

    });


    g.selectAll(".matrix-cell")
        .data(cells)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d => x(d.topic))
        .attr("y", d => y(d.section))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.count))
        .on("click", function(event, d) {

            selectMatrixCell(d);

        })
        .append("title")
        .text(d =>
            `${d.section} | ${d.topic}: ${d.count} passages`
        );


    // X labels

    g.selectAll(".x-label")
        .data(topics)
        .join("text")
        .attr("class", "x-label")
        .attr("transform", d =>
            `translate(
                ${x(d.topic) + x.bandwidth() / 2},
                -10
            ) rotate(-45)`
        )
        .attr("text-anchor", "start")
        .style("font-size", "11px")
        .text(d => d);


    // Y labels

    g.selectAll(".y-label")
        .data(sections)
        .join("text")
        .attr("class", "y-label")
        .attr("x", -10)
        .attr(
            "y",
            d => y(d) + y.bandwidth() / 2
        )
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .text(d => d);


    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -90)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Semantic Topic");


    g.append("text")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr("x", -innerHeight / 2)
        .attr("y", -150)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Bulletin Section");

}


// ============================================================
// 12. MATRIX → MAP
// ============================================================

function selectMatrixCell(d) {

    selectedMatrixCell = d;


    points
        .classed("dimmed", p => {

            return !(
                p.section === d.section &&
                p.cluster_name === d.topic
            );

        });


    d3.select("#detail-panel")
        .html(`

            <h3>Matrix Selection</h3>

            <p>
                <strong>Section:</strong>
                ${escapeHTML(d.section)}
            </p>

            <p>
                <strong>Topic:</strong>
                ${escapeHTML(d.topic)}
            </p>

            <p>
                <strong>Passages:</strong>
                ${d.count}
            </p>

            <p>
                The semantic map is highlighting
                passages belonging to this
                section-topic combination.
            </p>

        `);

}


// ============================================================
// 13. POINT → MATRIX
// ============================================================

function highlightMatrixCell(d) {

    matrixSvg
        .selectAll(".matrix-cell")
        .attr("stroke", null)
        .attr("stroke-width", null);


    matrixSvg
        .selectAll(".matrix-cell")
        .filter(cell =>
            cell.section === d.section &&
            cell.topic === d.cluster_name
        )
        .attr("stroke", "black")
        .attr("stroke-width", 3);

}


// ============================================================
// 14. UPDATE MATRIX HIGHLIGHT
// ============================================================

function updateMatrixHighlight() {

    if (!selectedMatrixCell) {
        return;
    }


    matrixSvg
        .selectAll(".matrix-cell")
        .attr("stroke", null)
        .attr("stroke-width", null);


    matrixSvg
        .selectAll(".matrix-cell")
        .filter(cell =>
            cell.section === selectedMatrixCell.section &&
            cell.topic === selectedMatrixCell.topic
        )
        .attr("stroke", "black")
        .attr("stroke-width", 3);

}


// ============================================================
// 15. RESET
// ============================================================

function resetVisualization() {

    d3.select("#search")
        .property("value", "");


    d3.select("#section-filter")
        .property("value", "all");


    d3.select("#topic-filter")
        .property("value", "all");


    selectedPoint = null;

    selectedMatrixCell = null;


    points
        .classed("dimmed", false)
        .classed("selected", false)
        .classed("neighbor", false);


    matrixSvg
        .selectAll(".matrix-cell")
        .attr("stroke", null)
        .attr("stroke-width", null);


    d3.select("#detail-panel")
        .html(`
            <p>
                Click a point on the semantic map
                to inspect a passage.
            </p>
        `);

}


// ============================================================
// 16. HTML ESCAPE
// ============================================================

function escapeHTML(str) {

    if (str === undefined || str === null) {
        return "";
    }

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
