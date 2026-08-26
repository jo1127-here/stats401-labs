async function loadData() {

    const data = await d3.csv(
        "../data/students.csv",
        d => ({
            name: d.name,
            score: +d.score
        })
    );

    const width = 800;
    const height = 500;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const barWidth = 60;
    const gap = 35;


    const barScale = 3;

    const chartBottom = 350;


    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d, i) => i * (barWidth + gap) + 30)
        .attr("y", d => chartBottom - d.score * barScale)
        .attr("width", barWidth)
        .attr("height", d => d.score * barScale)
        .attr("class", "bar");


    svg.selectAll(".score")
        .data(data)
        .join("text")
        .attr("class", "score")
        .attr("x", (d, i) => i * (barWidth + gap) + 30 + barWidth / 2)
        .attr("y", chartBottom + 25)
        .attr("text-anchor", "middle")
        .text(d => d.score);


    svg.selectAll(".name")
        .data(data)
        .join("text")
        .attr("class", "name")
        .attr("x", (d, i) => i * (barWidth + gap) + 30 + barWidth / 2)
        .attr("y", chartBottom + 50)
        .attr("text-anchor", "middle")
        .text(d => d.name);
}

loadData();
