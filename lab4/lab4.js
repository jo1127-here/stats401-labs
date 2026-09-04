d3.csv("../data/lab4_clean_tweets.csv", d => ({
    tweet_length: +d.tweet_length,
    sentiment_score: +d.sentiment_score
}))
.then(data => {

    // Group tweets by length ranges
    data.forEach(d => {
        d.length_group = Math.floor(d.tweet_length / 20) * 20;
    });

    const grouped = d3.rollups(
        data,
        v => d3.mean(v, d => d.sentiment_score),
        d => d.length_group
    )
    .map(([length, sentiment]) => ({
        length: length,
        sentiment: sentiment
    }))
    .sort((a, b) => a.length - b.length);

    console.log(grouped);

    // Chart dimensions
    const width = 900;
    const height = 550;

    const margin = {
        top: 60,
        right: 40,
        bottom: 80,
        left: 80
    };

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // X scale
    const x = d3.scaleBand()
        .domain(grouped.map(d => d.length))
        .range([
            margin.left,
            width - margin.right
        ])
        .padding(0.2);

    // Y scale
    const y = d3.scaleLinear()
        .domain([
            d3.min(grouped, d => d.sentiment),
            d3.max(grouped, d => d.sentiment)
        ])
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    // X axis
    svg.append("g")
        .attr(
            "transform",
            `translate(0,${height - margin.bottom})`
        )
        .call(
            d3.axisBottom(x)
                .tickFormat(d => `${d}–${+d + 19}`)
        );

    // Y axis
    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},0)`
        )
        .call(d3.axisLeft(y));

    // X axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 25)
        .attr("text-anchor", "middle")
        .text("Tweet Length (Characters)");

    // Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Average Sentiment Score");

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Average Sentiment by Tweet Length");

    // Bars
    svg.selectAll(".bar")
        .data(grouped)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.length))
        .attr("y", d => y(Math.max(0, d.sentiment)))
        .attr("width", x.bandwidth())
        .attr(
            "height",
            d => Math.abs(y(d.sentiment) - y(0))
        );
});
