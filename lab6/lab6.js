const width = 1000;
const height = 550;

const tooltip = d3.select("#tooltip");

// GDP status colors
const statusColor = {
    "Increase": "green",
    "Unchanged": "gray",
    "Decrease": "red"
};


// ==============================
// Build hierarchy from CSV
// ==============================
function buildHierarchy(data) {

    const root = {
        name: "World",
        children: []
    };

    const continents = d3.group(data, d => d.continent);

    continents.forEach((continentData, continentName) => {

        const continent = {
            name: continentName,
            children: []
        };

        const areas = d3.group(
            continentData,
            d => d.area
        );

        areas.forEach((areaData, areaName) => {

            const area = {
                name: areaName,
                children: []
            };

            areaData.forEach(d => {

                area.children.push({
                    name: d.country,
                    gdp: +d.gdp_billion_usd,
                    status: d.gdp_status.trim()
                });

            });

            continent.children.push(area);
        });

        root.children.push(continent);
    });

    return root;
}


// ==============================
// Get continent name
// ==============================
function getContinent(d) {

    // country → area → continent
    return d.parent.parent.data.name;
}


// ==============================
// Create treemap
// ==============================
function createTreemap(container, tileMethod, data) {

    const hierarchyData = buildHierarchy(data);

    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);


    const treemap = d3.treemap()
        .size([width, height])
        .paddingInner(3)
        .paddingOuter(5)
        .tile(tileMethod);

    treemap(root);


    // ==============================
    // SVG
    // ==============================
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    // ==============================
    // Country cells
    // ==============================
    const cells = svg.selectAll(".cell")
        .data(root.leaves())
        .join("g")
        .attr("class", "cell")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        );


    // ==============================
    // Rectangle
    // ==============================
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
            d => statusColor[d.data.status]
        );


    // ==============================
    // Country label
    // ==============================
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


    // ==============================
    // Tooltip
    // ==============================
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

}


// ==============================
// Load CSV ONCE
// ==============================
d3.csv("../data/lab6_assignment_gdp.csv")
    .then(data => {

        console.log("GDP data loaded:", data);

        // Squarify
        createTreemap(
            "#treemap1",
            d3.treemapSquarify,
            data
        );

        // Binary
        createTreemap(
            "#treemap2",
            d3.treemapBinary,
            data
        );

    })
    .catch(error => {

        console.error(
            "Could not load GDP CSV:",
            error
        );

    });


// ==============================
// Legend
// ==============================
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
        .style(
            "background",
            statusColor[status]
        );

    item.append("span")
        .text(status);

});
