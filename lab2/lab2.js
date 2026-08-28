const width = 800;
const height = 550;

const margin = {
    top: 50,
    right: 180,
    bottom: 70,
    left: 80
};

const tooltip = d3.select("#tooltip");

d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
}))
.then(data => {

    console.log("Data loaded:", data);

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Population → X position
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.population))
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    // Temperature → Y position
    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp_c))
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    // Region → Color
    const regions = [
        "North",
        "South",
        "East",
        "West"
    ];

    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeTableau10);

    // Development level → Circle size
    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Low",
            "Medium",
            "High"
        ])
        .range([
            8,
            16,
            25
        ]);

    // X axis
    svg.append("g")
        .attr(
            "transform",
            `translate(0, ${height - margin.bottom})`
        )
        .call(d3.axisBottom(xScale));

    // Y axis
    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yScale));

    // X axis label
    svg.append("text")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 20)
        .attr("text-anchor", "middle")
        .text("Population (millions)");

    // Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Average Temperature (°C)");

    // Draw circles
    svg.selectAll(".student-point")
        .data(data)
        .join("circle")
        .attr("class", "student-point")
        .attr("cx", d => xScale(d.population))
        .attr("cy", d => yScale(d.temp_c))
        .attr("r", d => sizeScale(d.development_level))
        .attr("fill", d => colorScale(d.region))
        .attr("opacity", 0.8)
        .attr("stroke", "black")
        .attr("stroke-width", 1)

        // Mouse over
        .on("mouseover", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.city}</strong><br>
                    Population: ${d.population} million<br>
                    Temperature: ${d.temp_c} °C<br>
                    Development: ${d.development_level}<br>
                    Region: ${d.region}
                `);
        })

        // Mouse move
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

        // Mouse out
        .on("mouseout", function() {

            tooltip
                .style("opacity", 0);
        });

    // City labels
    svg.selectAll(".city-label")
        .data(data)
        .join("text")
        .attr("class", "city-label")
        .attr("x", d => xScale(d.population))
        .attr(
            "y",
            d => yScale(d.temp_c) - sizeScale(d.development_level) - 7
        )
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .text(d => d.city);


    // -------------------------
    // Region Legend
    // -------------------------

    const regionLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 70)`
        );

    regionLegend.append("text")
        .attr("font-weight", "bold")
        .text("Region");

    const regionItems = regionLegend
        .selectAll(".region-item")
        .data(regions)
        .join("g")
        .attr("class", "region-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${25 + i * 25})`
        );

    regionItems.append("circle")
        .attr("r", 7)
        .attr("fill", d => colorScale(d));

    regionItems.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .text(d => d);


    // -------------------------
    // Development Level Legend
    // -------------------------

    const developmentLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 220)`
        );

    developmentLegend.append("text")
        .attr("font-weight", "bold")
        .text("Development Level");

    const developmentLevels = [
        "Low",
        "Medium",
        "High"
    ];

    const developmentItems = developmentLegend
        .selectAll(".development-item")
        .data(developmentLevels)
        .join("g")
        .attr("class", "development-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${35 + i * 55})`
        );

    developmentItems.append("circle")
        .attr("r", d => sizeScale(d))
        .attr("fill", "gray")
        .attr("opacity", 0.8)
        .attr("stroke", "black");

    developmentItems.append("text")
        .attr("x", 35)
        .attr("y", 4)
        .text(d => d);

});
