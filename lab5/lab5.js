const width = 900;
const height = 650;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

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

    /*
    --------------------------------
    1. SCALES
    --------------------------------
    */

    const districts = Array.from(
        new Set(nodes.map(d => d.district))
    );

    const districtColor = d3.scaleOrdinal()
        .domain(districts)
        .range(d3.schemeTableau10);


    const passengerSize = d3.scaleSqrt()
        .domain(
            d3.extent(nodes, d => d.daily_passengers)
        )
        .range([6, 22]);


    const travelWidth = d3.scaleLinear()
        .domain(
            d3.extent(links, d => d.travel_time_min)
        )
        .range([1, 7]);


    const routeTypes = Array.from(
        new Set(links.map(d => d.route_type))
    );

    const routeColor = d3.scaleOrdinal()
        .domain(routeTypes)
        .range(d3.schemeSet2);


    /*
    --------------------------------
    2. CREATE LINK-NODE OBJECTS
    --------------------------------
    */

    const simulation = d3.forceSimulation(nodes)

        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(110)
        )

        .force(
            "charge",
            d3.forceManyBody()
                .strength(-300)
        )

        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )

        .force(
            "collision",
            d3.forceCollide()
                .radius(30)
        );


    /*
    --------------------------------
    3. DRAW LINKS
    --------------------------------
    */

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr(
            "stroke",
            d => routeColor(d.route_type)
        )
        .attr(
            "stroke-width",
            d => travelWidth(d.travel_time_min)
        );


    /*
    --------------------------------
    4. DRAW NODES
    --------------------------------
    */

    const nodeGroup = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .join("g");


    /*
    Station type determines shape
    */


    nodeGroup.each(function(d) {

        const g = d3.select(this);

        const size = passengerSize(
            d.daily_passengers
        );

        const color = districtColor(
            d.district
        );


        if (d.station_type === "Transfer") {

            g.append("rect")
                .attr("x", -size)
                .attr("y", -size)
                .attr("width", size * 2)
                .attr("height", size * 2)
                .attr("fill", color);

        }

        else if (d.station_type === "Terminal") {

            const points = [
                [0, -size],
                [size, size],
                [-size, size]
            ]
                .map(p => p.join(","))
                .join(" ");

            g.append("polygon")
                .attr("points", points)
                .attr("fill", color);

        }

        else {

            g.append("circle")
                .attr("r", size)
                .attr("fill", color);

        }

    });


    /*
    --------------------------------
    5. LABELS
    --------------------------------
    */

    const label = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", "station-label")
        .text(d => d.station_name)
        .attr("dx", 12)
        .attr("dy", 4);


    /*
    --------------------------------
    6. FORCE TICK
    --------------------------------
    */

    simulation.on("tick", () => {

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);


        nodeGroup
            .attr(
                "transform",
                d => `translate(${d.x},${d.y})`
            );


        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);

    });


    /*
    --------------------------------
    7. CONNECTED NODES
    --------------------------------
    */

    function isConnected(a, b) {

        return links.some(l =>

            (
                l.source.id === a.id &&
                l.target.id === b.id
            )

            ||

            (
                l.source.id === b.id &&
                l.target.id === a.id
            )

        );

    }


    /*
    --------------------------------
    8. HIGHLIGHT
    --------------------------------
    */

    nodeGroup
        .on("mouseover.highlight", function(event, d) {

            nodeGroup
                .attr(
                    "opacity",
                    other =>
                        other.id === d.id ||
                        isConnected(d, other)
                        ? 1
                        : 0.15
                );


            link
                .attr(
                    "opacity",
                    l =>
                        l.source.id === d.id ||
                        l.target.id === d.id
                        ? 1
                        : 0.1
                );


            label
                .attr(
                    "opacity",
                    other =>
                        other.id === d.id ||
                        isConnected(d, other)
                        ? 1
                        : 0.15
                );

        })


        .on("mouseout.highlight", function() {

            nodeGroup.attr("opacity", 1);

            link.attr("opacity", 0.6);

            label.attr("opacity", 1);

        });


    /*
    --------------------------------
    9. TOOLTIP
    --------------------------------
    */

    nodeGroup

        .on("mouseover.tooltip", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.station_name}</strong>
                    <br>
                    District: ${d.district}
                    <br>
                    Daily passengers: ${d.daily_passengers}
                    <br>
                    Station type: ${d.station_type}
                `);

        })

        .on("mousemove.tooltip", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );

        })

        .on("mouseout.tooltip", function() {

            tooltip.style("opacity", 0);

        });


    /*
    --------------------------------
    10. DRAGGING
    --------------------------------
    */

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

            simulation
                .alphaTarget(0);

        }

        d.fx = null;
        d.fy = null;

    }


    nodeGroup.call(

        d3.drag()

            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)

    );


    /*
    ==========================================
    ADJACENCY MATRIX
    ==========================================
    */


    const matrixData = [];


    nodes.forEach(rowNode => {

        nodes.forEach(colNode => {

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

                weight: foundLink
                    ? foundLink.travel_time_min
                    : 0,

                type: foundLink
                    ? foundLink.route_type
                    : null

            });

        });

    });


    /*
    --------------------------------
    MATRIX SIZE
    --------------------------------
    */

    const matrixSize = 650;


    const matrixX = d3.scaleBand()
        .domain(nodes.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.03);


    const matrixY = d3.scaleBand()
        .domain(nodes.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.03);


    /*
    --------------------------------
    MATRIX SVG
    --------------------------------
    */

    const matrixSvg = d3.select("#matrix")
        .append("svg")
        .attr("width", 850)
        .attr("height", 800);


    const matrixGroup = matrixSvg
        .append("g")
        .attr(
            "transform",
            "translate(100,60)"
        );


    /*
    --------------------------------
    OPACITY SCALE
    --------------------------------
    */

    const travelOpacity = d3.scaleLinear()
        .domain(
            d3.extent(
                links,
                d => d.travel_time_min
            )
        )
        .range([0.35, 1]);


    /*
    --------------------------------
    MATRIX CELLS
    --------------------------------
    */

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
                d.weight > 0
                ? routeColor(d.type)
                : "#eeeeee"
        )

        .attr(
            "fill-opacity",
            d =>
                d.weight > 0
                ? travelOpacity(d.weight)
                : 1
        )

        .on("mouseover", function(event, d) {

            if (d.weight > 0) {

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>Connection</strong>
                        <br>
                        Travel time: ${d.weight} min
                        <br>
                        Route type: ${d.type}
                    `);

            }

        })

        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );

        })

        .on("mouseout", function() {

            tooltip.style("opacity", 0);

        });


    /*
    --------------------------------
    MATRIX LABELS
    --------------------------------
    */

    matrixGroup
        .selectAll(".row-label")
        .data(nodes)
        .join("text")
        .attr("class", "matrix-label")

        .attr(
            "x",
            -5
        )

        .attr(
            "y",
            d => matrixY(d.id) +
                 matrixY.bandwidth() / 2
        )

        .attr(
            "text-anchor",
            "end"
        )

        .text(d => d.station_name);


    matrixGroup
        .selectAll(".column-label")
        .data(nodes)
        .join("text")
        .attr("class", "matrix-label")

        .attr(
            "transform",
            d =>
                `translate(
                    ${matrixX(d.id) +
                      matrixX.bandwidth() / 2},
                    -8
                ) rotate(-60)`
        )

        .attr(
            "text-anchor",
            "end"
        )

        .text(d => d.station_name);

});
