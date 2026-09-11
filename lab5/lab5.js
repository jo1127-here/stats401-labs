const width = 650;
const height = 500;

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
        .domain(
            d3.extent(nodes, d => d.daily_passengers)
        )
        .range([4, 12]);


    // Travel time → link width
    const travelWidth = d3.scaleLinear()
        .domain(
            d3.extent(links, d => d.travel_time_min)
        )
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
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => passengerSize(d.daily_passengers))
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
        .attr("dx", 8)
        .attr("dy", 3)
        .style("pointer-events", "none");


    // ============================================================
    // 5. FORCE SIMULATION
    // ============================================================

    const simulation = d3.forceSimulation(nodes)

        // Connected stations attract each other
        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(45)
                .strength(0.8)
        )

        // Nodes repel each other
        .force(
            "charge",
            d3.forceManyBody()
                .strength(-55)
        )

        // Keep graph in center
        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )

        // Prevent nodes from overlapping
        .force(
            "collision",
            d3.forceCollide()
                .radius(
                    d => passengerSize(d.daily_passengers) + 3
                )
        );


    // ============================================================
    // 6. UPDATE POSITIONS
    // ============================================================

    simulation.on("tick", () => {

        // Keep nodes inside SVG
        nodes.forEach(d => {
            d.x = Math.max(15, Math.min(width - 15, d.x));
            d.y = Math.max(15, Math.min(height - 15, d.y));
        });


        // Update links
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);


        // Update nodes
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);


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
    // 11. LEGEND
    // ============================================================

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(15, 15)");


    // District legend
    districts.forEach((district, i) => {

        const row = legend.append("g")
            .attr(
                "transform",
                `translate(0, ${i * 20})`
            );

        row.append("circle")
            .attr("r", 6)
            .attr("fill", districtColor(district));

        row.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .attr("font-size", 10)
            .text(district);
    });


    // ============================================================
    // 12. STATION TYPE LEGEND
    // ============================================================

    const typeLegend = svg.append("g")
        .attr("class", "type-legend")
        .attr("transform", "translate(530, 15)");

    typeLegend.append("text")
        .attr("font-size", 10)
        .attr("font-weight", "bold")
        .text("Station Type");

    ["Local", "Transfer", "Terminal"].forEach((type, i) => {

        typeLegend.append("text")
            .attr("x", 0)
            .attr("y", 18 + i * 15)
            .attr("font-size", 9)
            .text(type);
    });


    // ============================================================
    // 13. DEBUG
    // ============================================================

    console.log("Nodes:", nodes);
    console.log("Links:", links);

});
