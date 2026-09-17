const width = 1000;
const height = 550;

const tooltip = d3.select("#tooltip");

// ==============================
// GDP status colors
// ==============================
const statusColor = {
    "Increase": "green",
    "Unchanged": "gray",
    "Decrease": "red"
};


// ==============================
// Build hierarchy
// World
//   Continent
//     Area
//       Country
// ==============================
function buildHierarchy(data) {

    const root = {
        name: "World",
        children: []
    };

    const continents = d3.group(
        data,
        d => d.continent
    );

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
// Get continent
// ==============================
function getContinent(d) {

    return d.parent.parent.data.name;

}


// ==============================
// Create Treemap
// ==============================
function createTreemap(
    container,
    tileMethod,
    data
) {

    const hierarchyData = buildHierarchy(data);

    const root = d3.hierarchy(hierarchyData)

        // Compress GDP differences
        // so smaller countries remain visible
        .sum(d => Math.sqrt(d.gdp || 0))

        .sort((a, b) => b.value - a.value);


    // ==============================
    // Treemap layout
    // ==============================
    const treemap = d3.treemap()
        .size([width, height])
        .paddingInner(2)
        .paddingOuter(4)
        .tile(tileMethod);

    treemap(root);


    // ==============================
    // SVG
    // ==============================
    const svg = d3.select(container)
        .append("svg")
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        )
        .attr(
            "width",
            "100%"
        )
        .attr(
            "height",
            "auto"
        );


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
            d => Math.max(0, d.x1 - d.x0)
        )
        .attr(
            "height",
            d => Math.max(0, d.y1 - d.y0)
        )
        .attr(
            "fill",
            d => statusColor[d.data.status]
        )
        .attr(
            "stroke",
            "white"
        )
        .attr(
            "stroke-width",
            1
        );


    // ==============================
    // Country labels
    // ==============================
    cells.append("text")
        .attr("x", 4)
        .attr("y", 15)
        .text(d => d.data.name)
        .style(
            "font-size",
            "11px"
        )
        .style(
            "pointer-events",
            "none"
        )
        .style(
            "display",
            d =>
                d.x1 - d.x0 > 45 &&
                d.y1 - d.y0 > 20
                    ? "block"
                    : "none"
        );


    // ==============================
    // Tooltip
    // ==============================
    cells
        .on("mouseover", function(event, d) {

            tooltip
                .style(
                    "opacity",
                    1
                )
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

            tooltip.style(
                "opacity",
                0
            );

        });

}


// ==============================
// Load GDP CSV
// ==============================
d3.csv("../data/lab6_assignment_gdp.csv")
    .then(data => {

        console.log(
            "GDP data loaded:",
            data
        );


        // ==========================
        // Treemap 1: Squarify
        // ==========================
        createTreemap(
            "#treemap1",
            d3.treemapSquarify,
            data
        );


        // ==========================
        // Treemap 2: Binary
        // ==========================
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
        .style(
            "display",
            "inline-block"
        )
        .style(
            "margin-right",
            "20px"
        );


    item.append("span")
        .style(
            "display",
            "inline-block"
        )
        .style(
            "width",
            "14px"
        )
        .style(
            "height",
            "14px"
        )
        .style(
            "margin-right",
            "5px"
        )
        .style(
            "background",
            statusColor[status]
        );


    item.append("span")
        .text(status);

});
