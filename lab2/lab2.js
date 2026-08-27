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

    console.log(data);

    // Create SVG
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // X scale: population
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.population))
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    // Y scale: temperature
    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp_c))
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    // Color scale: region
    const regions = Array.from(
        new Set(data.map(d => d.region))
    );

    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeTableau10);

    // Size scale: development level
    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Low",
            "Medium",
            "High"
        ])
        .range([
            10,
            18,
            26
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

    // Create bubbles
    svg.selectAll(".city")
        .data(data)
        .join("circle")
        .attr("class", "city")
        .attr("cx", d => xScale(d.population))
        .attr("cy", d => yScale(d.temp_c))
        .attr("r", d => sizeScale(d.development_level))
        .attr("fill", d => colorScale(d.region))
        .attr("opacity", 0.8)
        .attr("stroke", "black")

        // Tooltip
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

            tooltip
                .style("opacity", 0);

        });

    // City labels
    svg.selectAll(".city-label")
        .data(data)
        .join("text")
        .attr("class", "city-label")
        .attr("x", d => xScale(d.population))
        .attr("y", d => yScale(d.temp_c) - sizeScale(d.development_level) - 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .text(d => d.city);

    // Region legend
    const regionLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 60)`
        );

    regionLegend.append("text")
        .attr("font-weight", "bold")
        .attr("y", -15)
        .text("Region");

    const regionItems = regionLegend
        .selectAll(".region-item")
        .data(regions)
        .join("g")
        .attr("class", "region-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 25})`
        );

    regionItems.append("circle")
        .attr("r", 7)
        .attr("fill", d => colorScale(d));

    regionItems.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .text(d => d);

    // Development level legend
    const developmentLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 200)`
        );

    developmentLegend.append("text")
        .attr("font-weight", "bold")
        .attr("y", -15)
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
            (d, i) => `translate(0, ${i * 40})`
        );

    developmentItems.append("circle")
        .attr("r", d => sizeScale(d))
        .attr("fill", "gray")
        .attr("opacity", 0.8);

    developmentItems.append("text")
        .attr("x", 35)
        .attr("y", 4)
        .text(d => d);

});
