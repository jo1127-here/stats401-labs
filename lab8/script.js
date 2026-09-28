// ============================================================
// LAB 8 — COURSE DESCRIPTION SEMANTIC MAP
// ============================================================

const DATA_PATH = "../data/lab8_embedding_map.csv";

let data = [];
let points;
let matrixSvg;
let topicColor;
let selectedPoint = null;
let selectedMatrixCell = null;

const subjectNames = new Map();

d3.csv(DATA_PATH, d => ({
    ...d,
    x: +d.x,
    y: +d.y,
    word_count: +d.word_count,
    cluster: +d.cluster,
    page: +d.page,
    credits: d.credits === "" ? NaN : +d.credits,
    subject: (d.subject || "").trim().toUpperCase(),
    subject_name: (d.subject_name || d.subsection || d.subject || "").trim(),
    cluster_name: (d.cluster_name || "").trim()
}))
.then(rows => {
    data = rows.filter(d =>
        d.subject &&
        d.subject !== "UNKNOWN" &&
        d.cluster_name &&
        Number.isFinite(d.x) &&
        Number.isFinite(d.y)
    );

    if (!data.length) {
        throw new Error("CSV 中没有有效数据，请检查文件路径和字段。");
    }

    data.forEach(d => {
        subjectNames.set(d.subject, d.subject_name || d.subject);
    });

    createTopicColorScale();
    createFilters();
    createSemanticMap();
    createMatrix();
    createLegend();
    updateCorpusStats();

    console.log(`Loaded ${data.length} course passages.`);
    console.log("First passage:", data[0]);
})
.catch(error => {
    console.error("Failed to load Lab 8 data:", error);
});


// ============================================================
// BASIC DATA
// ============================================================

function getSubjects() {
    return [...subjectNames.keys()].sort((a, b) =>
        subjectNames.get(a).localeCompare(subjectNames.get(b))
    );
}

function getTopics() {
    return [...new Set(data.map(d => d.cluster_name))].sort();
}

function subjectLabel(code) {
    return `${subjectNames.get(code) || code} (${code})`;
}

function createTopicColorScale() {
    topicColor = d3.scaleOrdinal()
        .domain(getTopics())
        .range(d3.schemeTableau10);
}

function updateCorpusStats() {
    d3.select("#stat-passages").text(data.length);
    d3.select("#stat-subjects").text(getSubjects().length);
    d3.select("#stat-topics").text(getTopics().length);

    // HTML 中仍叫 stat-sections，但这里统计的是 Course Subjects。
    d3.select("#stat-sections").text(getSubjects().length);
}


// ============================================================
// FILTERS
// ============================================================

function createFilters() {
    const subjectSelect = d3.select("#section-filter");

    getSubjects().forEach(code => {
        subjectSelect.append("option")
            .attr("value", code)
            .text(subjectLabel(code));
    });

    const topicSelect = d3.select("#topic-filter");

    getTopics().forEach(topic => {
        topicSelect.append("option")
            .attr("value", topic)
            .text(topic);
    });

    subjectSelect.on("change", updateVisualization);
    topicSelect.on("change", updateVisualization);
    d3.select("#search").on("input", updateVisualization);
    d3.select("#reset").on("click", resetVisualization);
}

function updateVisualization() {
    const search = String(d3.select("#search").property("value") || "")
        .toLowerCase()
        .trim();

    const selectedSubject =
        d3.select("#section-filter").property("value");

    const selectedTopic =
        d3.select("#topic-filter").property("value");

    selectedMatrixCell = null;
    matrixSvg.selectAll(".matrix-cell")
        .attr("stroke", null)
        .attr("stroke-width", null);

    points.classed("dimmed", d => {
        const matchesSearch =
            !search ||
            (d.text || "").toLowerCase().includes(search) ||
            (d.course_title || "").toLowerCase().includes(search) ||
            (d.course_code || "").toLowerCase().includes(search);

        const matchesSubject =
            !selectedSubject ||
            selectedSubject === "all" ||
            d.subject === selectedSubject;

        const matchesTopic =
            !selectedTopic ||
            selectedTopic === "all" ||
            d.cluster_name === selectedTopic;

        return !(matchesSearch && matchesSubject && matchesTopic);
    });
}


// ============================================================
// SEMANTIC MAP
// ============================================================

function createSemanticMap() {
    const svg = d3.select("#map");
    const width = document.querySelector("#map")
        .getBoundingClientRect().width;
    const height = 570;

    svg.attr("width", width).attr("height", height);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x))
        .range([50, width - 50]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.y))
        .range([height - 50, 50]);

    points = svg.selectAll(".point")
        .data(data)
        .join("circle")
        .attr("class", "point")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d =>
            Math.max(3, Math.min(10, Math.sqrt(d.word_count || 0) / 2))
        )
        .attr("fill", d => topicColor(d.cluster_name))
        .on("click", (event, d) => {
            event.stopPropagation();
            selectPoint(d);
        });

    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on("zoom", event => {
            points.attr("transform", event.transform);
        });

    svg.call(zoom);

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

function selectPoint(d) {
    selectedPoint = d;

    points
        .classed("selected", p => p.passage_id === d.passage_id)
        .classed("neighbor", false);

    showMapDetails(d);
    highlightMatrixCell(d);
}

function showMapDetails(d) {
    d3.select("#map-detail-panel").html(`
        <h3>${escapeHTML(d.course_title || "Passage")}</h3>

        <div class="stat">
            <strong>Chapter</strong>
            ${escapeHTML(d.chapter || "N/A")}
        </div>

        <div class="stat">
            <strong>Section</strong>
            ${escapeHTML(d.section || "N/A")}
        </div>

        <div class="stat">
            <strong>Course Subject</strong>
            ${escapeHTML(subjectLabel(d.subject))}
        </div>

        <div class="stat">
            <strong>Page</strong>
            ${escapeHTML(d.page)}
        </div>

        <div class="stat">
            <strong>Course Code</strong>
            ${escapeHTML(d.course_code || "N/A")}
        </div>

        <div class="stat">
            <strong>Course Title</strong>
            ${escapeHTML(d.course_title || "N/A")}
        </div>

        <div class="stat">
            <strong>Credits</strong>
            ${Number.isFinite(d.credits) ? d.credits : "N/A"}
        </div>

        <div class="stat">
            <strong>Semantic Topic</strong>
            <span style="color:${topicColor(d.cluster_name)};font-weight:bold">
                ${escapeHTML(d.cluster_name)}
            </span>
        </div>

        <div class="stat">
            <strong>Word Count</strong>
            ${escapeHTML(d.word_count)}
        </div>

        <hr>
        <h3>Passage</h3>
        <p>${escapeHTML(d.text || "")}</p>
    `);
}


// ============================================================
// LEGEND
// ============================================================

function createLegend() {
    const container = d3.select("#legend");

    getTopics().forEach(topic => {
        const item = container.append("div")
            .attr("class", "legend-item");

        item.append("div")
            .attr("class", "legend-color")
            .style("background", topicColor(topic));

        item.append("span").text(topic);
    });
}


// ============================================================
// TOPIC × COURSE SUBJECT MATRIX
// ============================================================

function createMatrix() {
    matrixSvg = d3.select("#matrix");

    const subjects = getSubjects();
    const topics = getTopics();

    const width = document.querySelector("#matrix")
        .getBoundingClientRect().width;

    // 每个 Course Subject 至少约 24px，不再挤在固定 560px 内。
    const height = Math.max(560, 195 + subjects.length * 24);

    matrixSvg.attr("width", width).attr("height", height);

    const margin = {
        top: 145,
        right: 30,
        bottom: 50,
        left: 255
    };

    const innerWidth = Math.max(
        1,
        width - margin.left - margin.right
    );

    const innerHeight =
        height - margin.top - margin.bottom;

    const x = d3.scaleBand()
        .domain(topics)
        .range([0, innerWidth])
        .padding(0.08);

    const y = d3.scaleBand()
        .domain(subjects)
        .range([0, innerHeight])
        .padding(0.08);

    // 用 subject code 作 key，避免完整名称写法差异造成错位。
    const counts = d3.rollup(
        data,
        rows => rows.length,
        d => d.subject,
        d => d.cluster_name
    );

    const topicTotals = d3.rollup(
        data,
        rows => rows.length,
        d => d.cluster_name
    );

    const cells = subjects.flatMap(subject =>
        topics.map(topic => ({
            subject,
            topic,
            count: counts.get(subject)?.get(topic) || 0
        }))
    );

    const maxCount = d3.max(cells, d => d.count) || 1;

    const cellColor = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxCount]);

    const g = matrixSvg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );

    g.selectAll(".matrix-cell")
        .data(cells)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d => x(d.topic))
        .attr("y", d => y(d.subject))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => cellColor(d.count))
        .on("click", (event, d) => selectMatrixCell(d))
        .append("title")
        .text(d =>
            `${subjectLabel(d.subject)} | ${d.topic}: ${d.count} passages`
        );

    const xLabels = g.selectAll(".x-label")
        .data(topics)
        .join("text")
        .attr("class", "x-label")
        .attr("x", d => x(d) + x.bandwidth() / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", d => topicColor(d));

    xLabels.append("tspan")
        .attr("x", d => x(d) + x.bandwidth() / 2)
        .text(d => d);

    xLabels.append("tspan")
        .attr("x", d => x(d) + x.bandwidth() / 2)
        .attr("dy", 18)
        .style("fill", "#555")
        .style("font-size", "11px")
        .style("font-weight", "normal")
        .text(d => `n = ${topicTotals.get(d) || 0}`);

    g.selectAll(".topic-marker")
        .data(topics)
        .join("rect")
        .attr("class", "topic-marker")
        .attr("x", d => x(d) + x.bandwidth() / 2 - 5)
        .attr("y", -78)
        .attr("width", 10)
        .attr("height", 10)
        .attr("rx", 2)
        .attr("fill", d => topicColor(d));

    g.selectAll(".y-label")
        .data(subjects)
        .join("text")
        .attr("class", "y-label")
        .attr("x", -10)
        .attr("y", d => y(d) + y.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .text(d => subjectLabel(d));

    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -105)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Semantic Topic");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -225)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Course Subject");
}

function clearMatrixHighlight() {
    matrixSvg.selectAll(".matrix-cell")
        .attr("stroke", null)
        .attr("stroke-width", null);
}

function selectMatrixCell(cell) {
    selectedMatrixCell = cell;

    points.classed("dimmed", d =>
        !(
            d.subject === cell.subject &&
            d.cluster_name === cell.topic
        )
    );

    clearMatrixHighlight();

    matrixSvg.selectAll(".matrix-cell")
        .filter(d =>
            d.subject === cell.subject &&
            d.topic === cell.topic
        )
        .attr("stroke", "black")
        .attr("stroke-width", 3);

    d3.select("#matrix-detail-panel").html(`
        <h3>Matrix Selection</h3>
        <p><strong>Course Subject:</strong>
            ${escapeHTML(subjectLabel(cell.subject))}
        </p>
        <p><strong>Topic:</strong>
            <span style="color:${topicColor(cell.topic)};font-weight:bold">
                ${escapeHTML(cell.topic)}
            </span>
        </p>
        <p><strong>Passages:</strong> ${cell.count}</p>
        <p>The semantic map is highlighting passages in this
           subject-topic combination.</p>
    `);
}

function highlightMatrixCell(passage) {
    clearMatrixHighlight();

    matrixSvg.selectAll(".matrix-cell")
        .filter(cell =>
            cell.subject === passage.subject &&
            cell.topic === passage.cluster_name
        )
        .attr("stroke", "black")
        .attr("stroke-width", 3);
}


// ============================================================
// RESET
// ============================================================

function resetVisualization() {
    d3.select("#search").property("value", "");
    d3.select("#section-filter").property("value", "all");
    d3.select("#topic-filter").property("value", "all");

    selectedPoint = null;
    selectedMatrixCell = null;

    points
        .classed("dimmed", false)
        .classed("selected", false)
        .classed("neighbor", false);

    clearMatrixHighlight();

    d3.select("#map-detail-panel").html(`
        <p>Click a point on the semantic map to inspect a passage.</p>
    `);

    d3.select("#matrix-detail-panel").html(`
        <p>Click a matrix cell to inspect the subject-topic combination.</p>
    `);
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {
    if (value === undefined || value === null) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
