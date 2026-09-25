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

// Shared topic color scale
let topicColor;


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

        page: +d.page,
        credits: +d.credits

    };

}).then(loadedData => {

    // Exclude rows without valid section/subsection/subject
    data = loadedData.filter(d =>
        d.subject &&
        d.subject.trim().toLowerCase() !== "unknown"
    );

    console.log(
        "Loaded passages after excluding Unknown:",
        data.length
    );

    console.log(
        "First passage:",
        data[0]
    );

    console.log(
        "Chapter:",
        data[0]?.chapter
    );

    console.log(
        "Section:",
        data[0]?.section
    );

    console.log(
        "Subsection:",
        data[0]?.subsection
    );

    console.log(
        "Course Code:",
        data[0]?.course_code
    );

    console.log(
        "Course Title:",
        data[0]?.course_title
    );

    console.log(
        "Credits:",
        data[0]?.credits
    );

    console.log(
        "Page:",
        data[0]?.page
    );

    initialize();

}).catch(error => {

    console.error(
        "Error loading CSV:",
        error
    );

});


// ============================================================
// 3. INITIALIZE
// ============================================================

function initialize() {

    createTopicColorScale();
    createFilters();
    createSemanticMap();
    createMatrix();
    createLegend();
    updateCorpusStats();

}


function updateCorpusStats() {

    const subjects = new Set(
        data.map(d => d.subject)
    );

    const topics = new Set(
        data.map(d => d.cluster_name)
    );

    const sections = new Set(
        data.map(d => d.section)
    );

    d3.select("#stat-passages").text(data.length);
    d3.select("#stat-subjects").text(subjects.size);
    d3.select("#stat-topics").text(topics.size);
    d3.select("#stat-sections").text(sections.size);
}


// ============================================================
// 4. SHARED TOPIC COLOR SCALE
// ============================================================

function createTopicColorScale() {

    const topics = Array.from(
        new Set(
            data.map(d => d.cluster_name)
        )
    ).sort();

    topicColor = d3.scaleOrdinal()
        .domain(topics)
        .range(d3.schemeTableau10);

}


// ============================================================
// 5. FILTERS
// ============================================================

function createFilters() {

    const sections = Array.from(
        new Set(
            data.map(d => d.section)
        )
    ).sort();

    const topics = Array.from(
        new Set(
            data.map(d => d.cluster_name)
        )
    ).sort();


    const sectionSelect =
        d3.select("#section-filter");


    sections.forEach(section => {

        sectionSelect
            .append("option")
            .attr(
                "value",
                section
            )
            .text(section);

    });


    const topicSelect =
        d3.select("#topic-filter");


    topics.forEach(topic => {

        topicSelect
            .append("option")
            .attr(
                "value",
                topic
            )
            .text(topic);

    });


    sectionSelect.on(
        "change",
        updateVisualization
    );


    topicSelect.on(
        "change",
        updateVisualization
    );


    d3.select("#search")
        .on(
            "input",
            updateVisualization
        );


    d3.select("#reset")
        .on(
            "click",
            resetVisualization
        );

}


// ============================================================
// 6. SEMANTIC MAP
// ============================================================

function createSemanticMap() {

    svg = d3.select("#map");


    width =
        document
            .querySelector("#map")
            .getBoundingClientRect()
            .width;


    height = 570;


    svg
        .attr(
            "width",
            width
        )
        .attr(
            "height",
            height
        );


    xScale = d3.scaleLinear()
        .domain(
            d3.extent(
                data,
                d => d.x
            )
        )
        .range([
            50,
            width - 50
        ]);


    yScale = d3.scaleLinear()
        .domain(
            d3.extent(
                data,
                d => d.y
            )
        )
        .range([
            height - 50,
            50
        ]);


    points = svg
        .selectAll(".point")
        .data(data)
        .join("circle")
        .attr(
            "class",
            "point"
        )
        .attr(
            "cx",
            d => xScale(d.x)
        )
        .attr(
            "cy",
            d => yScale(d.y)
        )
        .attr(
            "r",
            d =>
                Math.max(
                    3,
                    Math.min(
                        10,
                        Math.sqrt(d.word_count) / 2
                    )
                )
        )
        .attr(
            "fill",
            d => topicColor(d.cluster_name)
        )
        .on(
            "click",
            function(event, d) {

                event.stopPropagation();

                selectPoint(d);

            }
        );


    // --------------------------------------------------------
    // Zoom / Pan
    // --------------------------------------------------------

    const zoom = d3.zoom()
        .scaleExtent([
            0.5,
            10
        ])
        .on(
            "zoom",
            event => {

                points.attr(
                    "transform",
                    event.transform
                );

            }
        );


    svg.call(zoom);


    // --------------------------------------------------------
    // Axes
    // --------------------------------------------------------

    svg.append("text")
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            height - 5
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "UMAP dimension 1"
        );


    svg.append("text")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -height / 2
        )
        .attr(
            "y",
            15
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "UMAP dimension 2"
        );

}


// ============================================================
// 7. LEGEND
// ============================================================

function createLegend() {

    const container =
        d3.select("#legend");


    const topics = Array.from(
        new Set(
            data.map(
                d => d.cluster_name
            )
        )
    ).sort();


    topics.forEach(topic => {

        const item =
            container
                .append("div")
                .attr(
                    "class",
                    "legend-item"
                );


        item.append("div")
            .attr(
                "class",
                "legend-color"
            )
            .style(
                "background",
                topicColor(topic)
            );


        item.append("span")
            .text(topic);

    });

}


// ============================================================
// 8. UPDATE MAP
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


    points.classed(
        "dimmed",
        d => {

            const searchMatch =
                search === "" ||
                (d.text || "")
                    .toLowerCase()
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

        }
    );

}


// ============================================================
// 9. SELECT POINT
// ============================================================

function selectPoint(d) {

    selectedPoint = d;


    // Remove previous selections
    points
        .classed(
            "selected",
            false
        )
        .classed(
            "neighbor",
            false
        );


    // Highlight clicked point
    points
        .filter(
            p =>
                p.passage_id ===
                d.passage_id
        )
        .classed(
            "selected",
            true
        );


    // Show passage detail
    showMapDetails(d);


    // Highlight corresponding matrix cell
    highlightMatrixCell(d);

}


// ============================================================
// 10. PASSAGE DETAIL
// ============================================================

function showMapDetails(d) {

    const panel =
        d3.select(
            "#map-detail-panel"
        );


    if (panel.empty()) {

        console.error(
            "Cannot find #map-detail-panel"
        );

        return;

    }


    panel.html(`

        <h3>
            ${escapeHTML(
                d.section || "Passage"
            )}
        </h3>


        <div class="stat">

            <strong>Chapter</strong>

            ${escapeHTML(
                d.chapter || "N/A"
            )}

        </div>


        <div class="stat">

            <strong>Section</strong>

            ${escapeHTML(
                d.section || "N/A"
            )}

        </div>


        <div class="stat">

            <strong>Subsection</strong>

            ${escapeHTML(
                d.subsection || "N/A"
            )}

        </div>


        <div class="stat">

            <strong>Page</strong>

            ${escapeHTML(
                d.page
            )}

        </div>


        <div class="stat">

            <strong>Course Code</strong>

            ${escapeHTML(
                d.course_code || "N/A"
            )}

        </div>


        <div class="stat">

            <strong>Course Title</strong>

            ${escapeHTML(
                d.course_title || "N/A"
            )}

        </div>


        <div class="stat">

            <strong>Credits</strong>

            ${
                Number.isFinite(d.credits)
                    ? d.credits
                    : "N/A"
            }

        </div>


        <div class="stat">

            <strong>Semantic Topic</strong>

            <span
                style="
                    color: ${topicColor(
                        d.cluster_name
                    )};
                    font-weight: bold;
                "
            >

                ${escapeHTML(
                    d.cluster_name ||
                    "N/A"
                )}

            </span>

        </div>


        <div class="stat">

            <strong>Word Count</strong>

            ${escapeHTML(
                d.word_count
            )}

        </div>


        <hr>


        <h3>Passage</h3>


        <p>

            ${escapeHTML(
                d.text
            )}

        </p>

    `);

}


// ============================================================
// 11. MATRIX
// ============================================================

function createMatrix() {

    matrixSvg =
        d3.select("#matrix");


    matrixWidth =
        document
            .querySelector("#matrix")
            .getBoundingClientRect()
            .width;


    matrixHeight = 560;


    matrixSvg
        .attr(
            "width",
            matrixWidth
        )
        .attr(
            "height",
            matrixHeight
        );


    const sections =
        Array.from(
            new Set(
                data.map(
                    d => d.section
                )
            )
        ).sort();


    const topics =
        Array.from(
            new Set(
                data.map(
                    d => d.cluster_name
                )
            )
        ).sort();


    const counts = {};


    data.forEach(d => {

        const key =
            `${d.section}|||${d.cluster_name}`;


        counts[key] =
            (counts[key] || 0) + 1;

    });


    // --------------------------------------------------------
    // Topic totals
    // --------------------------------------------------------

    const topicTotals = {};


    topics.forEach(topic => {

        topicTotals[topic] =
            data.filter(
                d =>
                    d.cluster_name ===
                    topic
            ).length;

    });


    const margin = {

        top: 145,

        right: 30,

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


    const x =
        d3.scaleBand()
            .domain(topics)
            .range([
                0,
                innerWidth
            ])
            .padding(0.08);


    const y =
        d3.scaleBand()
            .domain(sections)
            .range([
                0,
                innerHeight
            ])
            .padding(0.08);


    const maxCount =
        d3.max(
            Object.values(counts)
        );


    const cellColor =
        d3.scaleSequential(
            d3.interpolateBlues
        )
        .domain([
            0,
            maxCount
        ]);


    const g =
        matrixSvg
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top}
                )`
            );


    const cells = [];


    sections.forEach(
        section => {

            topics.forEach(
                topic => {

                    const count =
                        counts[
                            `${section}|||${topic}`
                        ] || 0;


                    cells.push({

                        section,

                        topic,

                        count

                    });

                }
            );

        }
    );


    // --------------------------------------------------------
    // MATRIX CELLS
    // --------------------------------------------------------

    g.selectAll(
        ".matrix-cell"
    )
        .data(cells)
        .join("rect")
        .attr(
            "class",
            "matrix-cell"
        )
        .attr(
            "x",
            d => x(d.topic)
        )
        .attr(
            "y",
            d => y(d.section)
        )
        .attr(
            "width",
            x.bandwidth()
        )
        .attr(
            "height",
            y.bandwidth()
        )
        .attr(
            "fill",
            d => cellColor(d.count)
        )
        .on(
            "click",
            function(event, d) {

                selectMatrixCell(d);

            }
        )
        .append("title")
        .text(
            d =>
                `${d.section} | ${d.topic}: ${d.count} passages`
        );


    // --------------------------------------------------------
    // TOPIC LABELS
    // --------------------------------------------------------

    const xLabels =
        g.selectAll(
            ".x-label"
        )
        .data(topics)
        .join("text")
        .attr(
            "class",
            "x-label"
        )
        .attr(
            "x",
            d =>
                x(d) +
                x.bandwidth() / 2
        )
        .attr(
            "y",
            -45
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .style(
            "font-size",
            "12px"
        )
        .style(
            "font-weight",
            "bold"
        )
        .style(
            "fill",
            d => topicColor(d)
        );


    xLabels.append("tspan")
        .attr(
            "x",
            d =>
                x(d) +
                x.bandwidth() / 2
        )
        .attr(
            "dy",
            0
        )
        .text(
            d => d
        );


    xLabels.append("tspan")
        .attr(
            "x",
            d =>
                x(d) +
                x.bandwidth() / 2
        )
        .attr(
            "dy",
            18
        )
        .style(
            "fill",
            "#555"
        )
        .style(
            "font-size",
            "11px"
        )
        .style(
            "font-weight",
            "normal"
        )
        .text(
            d =>
                `n = ${topicTotals[d]}`
        );


    // --------------------------------------------------------
    // TOPIC COLOR MARKERS
    // --------------------------------------------------------

    g.selectAll(
        ".topic-marker"
    )
        .data(topics)
        .join("rect")
        .attr(
            "class",
            "topic-marker"
        )
        .attr(
            "x",
            d =>
                x(d) +
                x.bandwidth() / 2 -
                5
        )
        .attr(
            "y",
            -78
        )
        .attr(
            "width",
            10
        )
        .attr(
            "height",
            10
        )
        .attr(
            "rx",
            2
        )
        .attr(
            "fill",
            d => topicColor(d)
        );


    // --------------------------------------------------------
    // Y LABELS
    // --------------------------------------------------------

    g.selectAll(
        ".y-label"
    )
        .data(sections)
        .join("text")
        .attr(
            "class",
            "y-label"
        )
        .attr(
            "x",
            -10
        )
        .attr(
            "y",
            d =>
                y(d) +
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
        .style(
            "font-size",
            "11px"
        )
        .text(
            d => d
        );


    // --------------------------------------------------------
    // AXIS TITLES
    // --------------------------------------------------------

    g.append("text")
        .attr(
            "x",
            innerWidth / 2
        )
        .attr(
            "y",
            -105
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .style(
            "font-weight",
            "bold"
        )
        .text(
            "Semantic Topic"
        );


    g.append("text")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -innerHeight / 2
        )
        .attr(
            "y",
            -150
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .style(
            "font-weight",
            "bold"
        )
        .text(
            "Bulletin Section"
        );

}


// ============================================================
// 12. MATRIX → MAP
// ============================================================

function selectMatrixCell(d) {

    selectedMatrixCell = d;


    // Highlight matching points
    points.classed(
        "dimmed",
        p =>
            !(
                p.section === d.section &&
                p.cluster_name === d.topic
            )
    );


    // Highlight selected matrix cell
    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .attr(
            "stroke",
            null
        )
        .attr(
            "stroke-width",
            null
        );


    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .filter(
            cell =>
                cell.section === d.section &&
                cell.topic === d.topic
        )
        .attr(
            "stroke",
            "black"
        )
        .attr(
            "stroke-width",
            3
        );


    // Matrix detail panel
    const panel =
        d3.select(
            "#matrix-detail-panel"
        );


    if (panel.empty()) {

        console.error(
            "Cannot find #matrix-detail-panel"
        );

        return;

    }


    panel.html(`

        <h3>
            Matrix Selection
        </h3>


        <p>

            <strong>
                Section:
            </strong>

            ${escapeHTML(
                d.section
            )}

        </p>


        <p>

            <strong>
                Topic:
            </strong>

            <span
                style="
                    color: ${topicColor(
                        d.topic
                    )};
                    font-weight: bold;
                "
            >

                ${escapeHTML(
                    d.topic
                )}

            </span>

        </p>


        <p>

            <strong>
                Passages:
            </strong>

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
        .selectAll(
            ".matrix-cell"
        )
        .attr(
            "stroke",
            null
        )
        .attr(
            "stroke-width",
            null
        );


    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .filter(
            cell =>
                cell.section === d.section &&
                cell.topic === d.cluster_name
        )
        .attr(
            "stroke",
            "black"
        )
        .attr(
            "stroke-width",
            3
        );

}


// ============================================================
// 14. UPDATE MATRIX HIGHLIGHT
// ============================================================

function updateMatrixHighlight() {

    if (!selectedMatrixCell) {

        return;

    }


    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .attr(
            "stroke",
            null
        )
        .attr(
            "stroke-width",
            null
        );


    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .filter(
            cell =>
                cell.section ===
                    selectedMatrixCell.section &&
                cell.topic ===
                    selectedMatrixCell.topic
        )
        .attr(
            "stroke",
            "black"
        )
        .attr(
            "stroke-width",
            3
        );

}


// ============================================================
// 15. RESET
// ============================================================

function resetVisualization() {

    d3.select("#search")
        .property(
            "value",
            ""
        );


    d3.select("#section-filter")
        .property(
            "value",
            "all"
        );


    d3.select("#topic-filter")
        .property(
            "value",
            "all"
        );


    selectedPoint = null;

    selectedMatrixCell = null;


    points
        .classed(
            "dimmed",
            false
        )
        .classed(
            "selected",
            false
        )
        .classed(
            "neighbor",
            false
        );


    matrixSvg
        .selectAll(
            ".matrix-cell"
        )
        .attr(
            "stroke",
            null
        )
        .attr(
            "stroke-width",
            null
        );


    // Reset Passage Detail

    d3.select(
        "#map-detail-panel"
    )
        .html(`
            <p>
                Click a point on the semantic map
                to inspect a passage.
            </p>
        `);


    // Reset Matrix Detail

    d3.select(
        "#matrix-detail-panel"
    )
        .html(`
            <p>
                Click a matrix cell to inspect
                the section-topic combination.
            </p>
        `);

}


// ============================================================
// 16. HTML ESCAPE
// ============================================================

function escapeHTML(str) {

    if (
        str === undefined ||
        str === null
    ) {

        return "";

    }


    return String(str)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}
