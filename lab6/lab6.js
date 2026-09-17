const width = 1000;
const height = 550;

const tooltip = d3.select("#tooltip");


// GDP status colors
const statusColor = d3.scaleOrdinal()
    .domain(["Increase", "Unchanged", "Decrease"])
    .range(["green", "gray", "red"]);


// Get continent name
function getContinent(d) {
    let node = d;

    while (node.depth > 1) {
        node = node.parent;
    }

    return node.data.name;
}


// Create one treemap
function createTreemap(container, tileMethod) {

    d3.json("d3.csv("../data/lab6_assignment_gdp.csv")")
        .then(data => {

            // Convert JSON to D3 hierarchy
            const root = d3.hierarchy(data)
                .sum(d => d.gdp || 0)
                .sort((a, b) => b.value - a.value);


            // Treemap layout
            const treemap = d3.treemap()
                .size([width, height])
                .paddingInner(3)
                .paddingOuter(5)
                .tile(tileMethod);


            treemap(root);


            // SVG
            const svg = d3.select(container)
                .append("svg")
                .attr("width", width)
                .attr("height", height);


            // Only country nodes
            const cells = svg.selectAll(".cell")
                .data(root.leaves())
                .join("g")
                .attr("class", "cell")
                .attr(
                    "transform",
                    d => `translate(${d.x0}, ${d.y0})`
                );


            // Rectangle
            cells.append("rect")
                .attr(
                    "width",
                    d => d.x1 - d.x0
                )
                .attr(
                    "height",
                    d => d.y1 - d.y0
                )
                .attr(
                    "fill",
                    d => statusColor(d.data.status)
                );


            // Country label
            cells.append("text")
                .attr("x", 5)
                .attr("y", 18)
                .text(d => d.data.name)
                .style(
                    "display",
                    d =>
                        d.x1 - d.x0 > 70 &&
                        d.y1 - d.y0 > 25
                            ? "block"
                            : "none"
                );


            // Tooltip
            cells
                .on("mouseover", function(event, d) {

                    tooltip
                        .style("opacity", 1)
                        .html(`
                            <strong>${d.data.name}</strong><br>
                            Continent: ${getContinent(d)}<br>
                            Area: ${d.parent.data.name}<br>
                            GDP: $${d.data.gdp} billion<br>
                            Status: ${d.data.status}
                        `);

                })
                .on("mousemove", function(event) {

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
                .on("mouseout", function() {

                    tooltip.style("opacity", 0);

                });

        })

        .catch(error => {
            console.error(
                "Could not load JSON:",
                error
            );
        });
}


// ------------------------------------
// Treemap 1: Squarify
// ------------------------------------

createTreemap(
    "#treemap1",
    d3.treemapSquarify
);


// ------------------------------------
// Treemap 2: Binary
// ------------------------------------

createTreemap(
    "#treemap2",
    d3.treemapBinary
);


// ------------------------------------
// Legend
// ------------------------------------

const statuses = [
    "Increase",
    "Unchanged",
    "Decrease"
];

const legend = d3.select("#legend");

statuses.forEach(status => {

    const item = legend
        .append("div")
        .style("display", "inline-block")
        .style("margin-right", "20px");


    item.append("span")
        .style("display", "inline-block")
        .style("width", "14px")
        .style("height", "14px")
        .style("margin-right", "5px")
        .style("background", statusColor(status));


    item.append("span")
        .text(status);
});
