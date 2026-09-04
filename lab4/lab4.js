d3.csv("../data/lab4_clean_tweets.csv", d => ({
    tweet_length: +d.tweet_length,
    sentiment: d.roberta_sentiment
}))
.then(data => {

    // 1. Create tweet-length groups
    data.forEach(d => {
        if (d.tweet_length <= 20) {
            d.length_group = "0–20";
        } else if (d.tweet_length <= 40) {
            d.length_group = "21–40";
        } else if (d.tweet_length <= 60) {
            d.length_group = "41–60";
        } else if (d.tweet_length <= 80) {
            d.length_group = "61–80";
        } else if (d.tweet_length <= 100) {
            d.length_group = "81–100";
        } else if (d.tweet_length <= 120) {
            d.length_group = "101–120";
        } else if (d.tweet_length <= 140) {
            d.length_group = "121–140";
        } else {
            d.length_group = "141+";
        }
    });

    // 2. Count sentiment within each length group
    const groups = d3.rollups(
        data,
        values => {
            const total = values.length;

            const negative = values.filter(
                d => d.sentiment === "Negative"
            ).length;

            const neutral = values.filter(
                d => d.sentiment === "Neutral"
            ).length;

            const positive = values.filter(
                d => d.sentiment === "Positive"
            ).length;

            return {
                Negative: negative / total,
                Neutral: neutral / total,
                Positive: positive / total
            };
        },
        d => d.length_group
    );

    // Convert to normal objects
    const summary = groups.map(([length_group, values]) => ({
        length_group,
        ...values
    }));

    // Keep groups in the correct order
    const order = [
        "0–20",
        "21–40",
        "41–60",
        "61–80",
        "81–100",
        "101–120",
        "121–140",
        "141+"
    ];

    summary.sort(
        (a, b) =>
            order.indexOf(a.length_group) -
            order.indexOf(b.length_group)
    );

    // 3. Chart dimensions
    const margin = {
        top: 50,
        right: 30,
        bottom: 70,
        left: 70
    };

    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // 4. Create SVG
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );

    // 5. X scale
    const x = d3.scaleBand()
        .domain(summary.map(d => d.length_group))
        .range([0, width])
        .padding(0.2);

    // 6. Y scale
    const y = d3.scaleLinear()
        .domain([0, 1])
        .range([height, 0]);

    // 7. Stack data
    const stack = d3.stack()
        .keys(["Negative", "Neutral", "Positive"]);

    const stackedData = stack(summary);

    // 8. Draw bars
    svg.selectAll(".layer")
        .data(stackedData)
        .join("g")
        .attr("class", "layer")
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.length_group))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("fill", (d, i, nodes) => {
            const key = d3.select(nodes[i].parentNode).datum().key;

            if (key === "Negative") {
                return "#e74c3c";
            }

            if (key === "Neutral") {
                return "#95a5a6";
            }

            return "#2ecc71";
        });

    // 9. X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // 10. Y axis
    svg.append("g")
        .call(
            d3.axisLeft(y)
                .tickFormat(d3.format(".0%"))
        );

    // 11. X axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 55)
        .attr("text-anchor", "middle")
        .text("Tweet Length (characters)");

    // 12. Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Percentage of Tweets");

    // 13. Chart title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Tweet Sentiment Distribution by Tweet Length");
});
