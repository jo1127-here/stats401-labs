const width = 800;
const height = 680;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = d3.select("#tooltip");

Promise.all([
    d3.csv("../data/lab5_assignment_stations.csv", d => ({
    id: d.id,
    station_name: d.station_name,
    district: d.district,
    daily_passengers: +d.daily_passengers,
    station_type: d.station_type
    })),


d3.csv("../data/lab5_assignment_routes.csv", d => ({
    source: d.source,
    target: d.target,
    travel_time_min: +d.travel_time_min,
    route_type: d.route_type
}))


])

.then(([nodes, links]) => {


// ============================================================
// 1. SCALES
// ============================================================

// District → node color
const districts = Array.from(
    new Set(nodes.map(d => d.district))
);

const districtColor = d3.scaleOrdinal()
    .domain(districts)
    .range(d3.schemeTableau10);


// Daily passengers → node size
const passengerSize = d3.scaleSqrt()
    .domain(d3.extent(nodes, d => d.daily_passengers))
    .range([5, 13]);


// Travel time → link width
const travelWidth = d3.scaleLinear()
    .domain(d3.extent(links, d => d.travel_time_min))
    .range([1, 5]);


// Route type → link color
const routeTypes = Array.from(
    new Set(links.map(d => d.route_type))
);

const routeColor = d3.scaleOrdinal()
    .domain(routeTypes)
    .range(d3.schemeSet2);


// ============================================================
// 2. DRAW LINKS
// ============================================================

const link = svg.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", d => routeColor(d.route_type))
    .attr("stroke-width", d => travelWidth(d.travel_time_min))
    .attr("stroke-opacity", 0.6);


// ============================================================
// 3. DRAW NODES
// ============================================================

const node = svg.append("g")
    .attr("class", "nodes")
    .selectAll("path")
    .data(nodes)
    .join("path")
    .attr("d", d => {

        const r = passengerSize(d.daily_passengers);

        if (d.station_type === "Local") {
            return d3.symbol()
                .type(d3.symbolCircle)
                .size(Math.PI * r * r)();
        }

        if (d.station_type === "Transfer") {
            return d3.symbol()
                .type(d3.symbolSquare)
                .size((r * 1.7) ** 2)();
        }

        if (d.station_type === "Terminal") {
            return d3.symbol()
                .type(d3.symbolTriangle)
                .size((r * 2) ** 2)();
        }

        // Default shape
        return d3.symbol()
            .type(d3.symbolCircle)
            .size(Math.PI * r * r)();
    })
    .attr("fill", d => districtColor(d.district))
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer");


// ============================================================
// 4. LABELS
// ============================================================

const label = svg.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.station_name)
    .attr("font-size", 9)
    .attr("dx", 9)
    .attr("dy", 3)
    .style("pointer-events", "none");


// ============================================================
// 5. FORCE SIMULATION
// ============================================================

const simulation = d3.forceSimulation(nodes)

    .force(
        "link",
        d3.forceLink(links)
            .id(d => d.id)
            .distance(55)
            .strength(0.8)
    )

    .force(
        "charge",
        d3.forceManyBody()
            .strength(-70)
    )

    .force(
        "center",
        d3.forceCenter(
            width / 2,
            245,
        )
    )

    .force(
        "collision",
        d3.forceCollide()
            .radius(
                d => passengerSize(d.daily_passengers) + 8
            )
    );


// ============================================================
// 6. UPDATE POSITIONS
// ============================================================

simulation.on("tick", () => {

    // Keep graph away from the edges
    nodes.forEach(d => {

        d.x = Math.max(
            50,
            Math.min(width - 130, d.x)
        );

        d.y = Math.max(
            40,
            Math.min(470, d.y)
        );
    });


    // Update links
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);


    // IMPORTANT:
    // path uses transform, NOT cx/cy
    node
        .attr(
            "transform",
            d => `translate(${d.x}, ${d.y})`
        );


    // Update labels
    label
        .attr("x", d => d.x)
        .attr("y", d => d.y);

});


// ============================================================
// 7. DRAGGING
// ============================================================

function dragStarted(event, d) {

    if (!event.active) {
        simulation
            .alphaTarget(0.3)
            .restart();
    }

    d.fx = d.x;
    d.fy = d.y;
}


function dragged(event, d) {

    d.fx = event.x;
    d.fy = event.y;
}


function dragEnded(event, d) {

    if (!event.active) {
        simulation.alphaTarget(0);
    }

    d.fx = null;
    d.fy = null;
}


node.call(
    d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
);


// ============================================================
// 8. CONNECTED NODE HELPER
// ============================================================

function isConnected(nodeA, nodeB) {

    return links.some(
        link =>
            (
                link.source.id === nodeA.id &&
                link.target.id === nodeB.id
            )
            ||
            (
                link.source.id === nodeB.id &&
                link.target.id === nodeA.id
            )
    );
}


// ============================================================
// 9. HIGHLIGHT CONNECTED NODES
// ============================================================

node.on("mouseover.highlight", function(event, d) {

    node.attr(
        "opacity",
        other =>
            (
                other.id === d.id ||
                isConnected(d, other)
            )
                ? 1
                : 0.15
    );


    link.attr(
        "opacity",
        l =>
            (
                l.source.id === d.id ||
                l.target.id === d.id
            )
                ? 1
                : 0.1
    );


    label.attr(
        "opacity",
        other =>
            (
                other.id === d.id ||
                isConnected(d, other)
            )
                ? 1
                : 0.15
    );

});


node.on("mouseout.highlight", function() {

    node.attr("opacity", 1);

    link.attr("opacity", 0.6);

    label.attr("opacity", 1);

});


// ============================================================
// 10. TOOLTIP
// ============================================================

node
    .on("mouseover.tooltip", function(event, d) {

        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.station_name}</strong>
                <br>
                District: ${d.district}
                <br>
                Passengers: ${d.daily_passengers}
                <br>
                Type: ${d.station_type}
            `);

    })

    .on("mousemove.tooltip", function(event) {

        tooltip
            .style(
                "left",
                `${event.pageX + 10}px`
            )
            .style(
                "top",
                `${event.pageY + 10}px`
            );

    })

    .on("mouseout.tooltip", function() {

        tooltip
            .style("opacity", 0);

    });


// ============================================================
// 11. DISTRICT LEGEND
// ============================================================

const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(40, 520)");

legend.append("text")
    .attr("font-size", 10)
    .attr("font-weight", "bold")
    .text("District");


districts.forEach((district, i) => {

    const row = legend.append("g")
        .attr(
            "transform",
            `translate(0, ${18 + i * 16})`
        );

    row.append("circle")
        .attr("r", 5)
        .attr("fill", districtColor(district));

    row.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .attr("font-size", 9)
        .text(district);

});


// ============================================================
// 12. STATION TYPE LEGEND
// ============================================================

const typeLegend = svg.append("g")
    .attr("class", "type-legend")
    .attr("transform", "translate(250, 520)");

typeLegend.append("text")
    .attr("font-size", 10)
    .attr("font-weight", "bold")
    .text("Station Type");


const typeShapes = [
    {
        type: "Local",
        shape: d3.symbolCircle
    },
    {
        type: "Transfer",
        shape: d3.symbolSquare
    },
    {
        type: "Terminal",
        shape: d3.symbolTriangle
    }
];


typeShapes.forEach((item, i) => {

    typeLegend.append("path")
        .attr(
            "d",
            d3.symbol()
                .type(item.shape)
                .size(70)()
        )
        .attr(
            "transform",
            `translate(6, ${18 + i * 16})`
        )
        .attr("fill", "gray")
        .attr("stroke", "black");


    typeLegend.append("text")
        .attr("x", 18)
        .attr("y", 22 + i * 16)
        .attr("font-size", 9)
        .text(item.type);

});


// ============================================================
// 13. LEGEND FOR NODE SIZE
// ============================================================

const sizeLegend = svg.append("g")
    .attr("class", "size-legend")
    .attr("transform", "translate(500, 520)");

sizeLegend.append("text")
    .attr("font-size", 10)
    .attr("font-weight", "bold")
    .text("Node Size = Daily Passengers");


sizeLegend.append("text")
    .attr("y", 18)
    .attr("font-size", 9)
    .text("Larger node = more passengers");


// ============================================================
// 14. ADJACENCY MATRIX
// ============================================================

// Order stations by district, then by station ID
const districtOrder = [
    "Central",
    "North",
    "South",
    "East",
    "West"
];

const matrixNodes = [...nodes].sort((a, b) => {

    const districtA = districtOrder.indexOf(a.district);
    const districtB = districtOrder.indexOf(b.district);

    if (districtA !== districtB) {
        return districtA - districtB;
    }

    return d3.ascending(a.id, b.id);
});


// Create matrix data
const matrixData = [];

matrixNodes.forEach(rowNode => {

    matrixNodes.forEach(colNode => {

        const foundLink = links.find(link =>
            (
                link.source.id === rowNode.id &&
                link.target.id === colNode.id
            )
            ||
            (
                link.source.id === colNode.id &&
                link.target.id === rowNode.id
            )
        );

        matrixData.push({

            row: rowNode.id,

            col: colNode.id,

            connected: foundLink ? 1 : 0,

            travel_time_min: foundLink
                ? foundLink.travel_time_min
                : 0,

            route_type: foundLink
                ? foundLink.route_type
                : null
        });

    });

});


// ============================================================
// 15. MATRIX SCALES
// ============================================================

const matrixSize = 650;

const matrixX = d3.scaleBand()
    .domain(matrixNodes.map(d => d.id))
    .range([0, matrixSize])
    .padding(0.08);

const matrixY = d3.scaleBand()
    .domain(matrixNodes.map(d => d.id))
    .range([0, matrixSize])
    .padding(0.08);


// Travel time → cell opacity
const matrixOpacity = d3.scaleLinear()
    .domain(
        d3.extent(
            links,
            d => d.travel_time_min
        )
    )
    .range([0.3, 1]);


// Route type → cell color
const matrixRouteColor = d3.scaleOrdinal()
    .domain(routeTypes)
    .range(d3.schemeSet2);

// ============================================================
// 16. DRAW MATRIX
// ============================================================

const matrixSvg = d3.select("#matrix")
    .append("svg")
    .attr("width", 850)
    .attr("height", 800);


const matrixGroup = matrixSvg.append("g")
    .attr(
        "transform",
        "translate(120, 90)"
    );


// Draw cells
matrixGroup
    .selectAll("rect")
    .data(matrixData)
    .join("rect")

    .attr(
        "x",
        d => matrixX(d.col)
    )

    .attr(
        "y",
        d => matrixY(d.row)
    )

    .attr(
        "width",
        matrixX.bandwidth()
    )

    .attr(
        "height",
        matrixY.bandwidth()
    )

    .attr(
        "fill",
        d =>
            d.connected
                ? matrixRouteColor(d.route_type)
                : "#eeeeee"
    )

    .attr(
        "fill-opacity",
        d =>
            d.connected
                ? matrixOpacity(d.travel_time_min)
                : 1
    )

    .attr(
        "stroke",
        "white"
    );

// ============================================================
// 17. MATRIX LABELS
// ============================================================

// Show every 5th station on the top axis
const columnLabels = matrixNodes.filter((d, i) => i % 5 === 0);


// Column labels
matrixGroup
    .selectAll(".column-label")
    .data(matrixNodes)
    .join("text")
    .attr("class", "column-label")
    .attr(
        "x",
        d => matrixX(d.id) + matrixX.bandwidth() / 2
    )
    .attr(
        "y",
        -10
    )
    .attr(
        "text-anchor",
        "start"
    )
    .attr(
        "font-size",
        8
    )
    .attr(
        "transform",
        d => `
            rotate(-90,
            ${matrixX(d.id) + matrixX.bandwidth() / 2},
            -10)
        `
    )
    .text(d => d.id);


// Row labels
matrixGroup
    .selectAll(".row-label")
    .data(matrixNodes)
    .join("text")
    .attr("class", "row-label")

    .attr(
        "x",
        -10
    )

    .attr(
        "y",
        d =>
            matrixY(d.id) +
            matrixY.bandwidth() / 2
    )

    .attr(
        "text-anchor",
        "end"
    )

    .attr(
        "dominant-baseline",
        "middle"
    )

    .attr(
        "font-size",
        9
    )

    .text(d => d.id);

// ============================================================
// 18. MATRIX TOOLTIP
// ============================================================

matrixGroup
    .selectAll("rect")
    .on("mouseover", function(event, d) {

        if (d.connected) {

            matrixTooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.row} ↔ ${d.col}</strong>
                    <br>
                    Connected: Yes
                    <br>
                    Travel time: ${d.travel_time_min} min
                    <br>
                    Route type: ${d.route_type}
                `);

        } else {

            matrixTooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.row} ↔ ${d.col}</strong>
                    <br>
                    Connected: No
                `);

        }

    })

    .on("mousemove", function(event) {

        matrixTooltip
            .style(
                "left",
                `${event.pageX + 10}px`
            )
            .style(
                "top",
                `${event.pageY + 10}px`
            );

    })

    .on("mouseout", function() {

        matrixTooltip
            .style("opacity", 0);

    });


// ============================================================
// 19. MATRIX TITLE
// ============================================================

matrixSvg
    .append("text")
    .attr("x", 445)
    .attr("y", 35)
    .attr("text-anchor", "middle")
    .attr("font-size", 18)
    .attr("font-weight", "bold")
    .text("Station Adjacency Matrix");

// ============================================================
// 20. DEBUG
// ============================================================

console.log("Nodes:", nodes);
console.log("Links:", links);
console.log("Matrix:", matrixData);


});
