const width = 1000;
const height = 550;

const tooltip = d3.select("#tooltip");

const statusColors = d3.scaleOrdinal()
    .domain(["Increase", "Unchanged", "Decrease"])
    .range([
        "#2ca02c",
        "#7f7f7f",
        "#d62728"
    ]);


function getContinent(d) {
    let current = d;

    while (current.depth > 1) {
        current = current.parent;
    }

    return current.data.name;
}


function createTreemap(container, tileMethod) {

    d3.json("../data/lab6_assignment_gdp.json")
        .then(data => {

            const root = d3.hierarchy(data)
                .sum(d => d.gdp || 0)
                .sort((a, b) => b.value - a.value);

            const layout = d3.treemap()
                .size([width, height])
                .paddingInner(3)
                .paddingOuter(5)
                .tile(tileMethod);

            layout(root);

            const svg = d3.select(container)
                .append("svg")
                .attr("width", width)
                .attr("height", height);

            const cells = svg.selectAll(".cell")
                .data(root.leaves())
                .join("g")
                .attr("class", "cell")
                .attr(
                    "transform",
                    d => `translate(${d.x0},${d.y0})`
                );

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
                    d => statusColors(d.data.status)
                );

            cells.append("text")
                .attr("x", 5)
                .attr("y", 16)
                .text(d => d.data.name)
                .style(
                    "display",
                    d =>
                        (d.x1 - d.x0 > 70 &&
                         d.y1 - d.y0 > 25)
                            ? "block"
                            : "none"
                );

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
        });
}


// Treemap 1: Squarify
createTreemap(
    "#treemap1",
    d3.treemapSquarify
);


// Treemap 2: Binary
createTreemap(
    "#treemap2",
    d3.treemapBinary
);


// Legend
const legendData = [
    "Increase",
    "Unchanged",
    "Decrease"
];

const legend = d3.select("#legend");

legendData.forEach(status => {

    const item = legend
        .append("span")
        .attr("class", "legend-item");

    item.append("span")
        .attr("class", "legend-box")
        .style(
            "background",
            statusColors(status)
        );

    item.append("span")
        .text(status);
});
