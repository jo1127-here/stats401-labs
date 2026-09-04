d3.csv(
    "../data/lab4_clean_tweets.csv",
    d => ({
        ...d,

        tweet_length: +d.tweet_length,
        word_count: +d.word_count,
        sentiment_score: +d.sentiment_score
    })
)
.then(data => {

    console.log("Loaded data:", data);
    console.log("Number of tweets:", data.length);


    // =========================
    // Chart dimensions
    // =========================

    const width = 900;
    const height = 550;

    const margin = {
        top: 60,
        right: 40,
        bottom: 70,
        left: 80
    };


    // =========================
    // SVG
    // =========================

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    // =========================
    // X scale
    // =========================

    const x = d3.scaleLinear()
        .domain([
            0,
            d3.max(data, d => d.tweet_length)
        ])
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);


    // =========================
    // Y scale
    // =========================

    const y = d3.scaleLinear()
        .domain([-1, 1])
        .range([
            height - margin.bottom,
            margin.top
        ]);


    // =========================
    // X axis
    // =========================

    svg.append("g")
        .attr(
            "transform",
            `translate(0,${height - margin.bottom})`
        )
        .call(d3.axisBottom(x));


    // =========================
    // Y axis
    // =========================

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},0)`
        )
        .call(d3.axisLeft(y));


    // =========================
    // X axis label
    // =========================

    svg.append("text")
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            height - 20
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text("Tweet Length (Characters)");


    // =========================
    // Y axis label
    // =========================

    svg.append("text")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -height / 2
        )
        .attr(
            "y",
            20
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text("Sentiment Score");


    // =========================
    // Chart title
    // =========================

    svg.append("text")
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            30
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .style(
            "font-size",
            "18px"
        )
        .style(
            "font-weight",
            "bold"
        )
        .text(
            "Tweet Sentiment vs. Tweet Length"
        );


    // =========================
    // Tooltip
    // =========================

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);


    // =========================
    // Scatter plot
    // =========================

    svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")

        .attr(
            "cx",
            d => x(d.tweet_length)
        )

        .attr(
            "cy",
            d => y(d.sentiment_score)
        )

        .attr(
            "r",
            4
        )

        .on("mouseover", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>Tweet:</strong>
                    ${d.text}<br><br>

                    <strong>Sentiment:</strong>
                    ${d.roberta_sentiment}<br>

                    <strong>Sentiment Score:</strong>
                    ${d.sentiment_score.toFixed(3)}<br>

                    <strong>Tweet Length:</strong>
                    ${d.tweet_length} characters<br>

                    <strong>Word Count:</strong>
                    ${d.word_count}
                `);

        })

        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    (event.pageX + 10) + "px"
                )
                .style(
                    "top",
                    (event.pageY + 10) + "px"
                );

        })

        .on("mouseout", function() {

            tooltip
                .style("opacity", 0);

        });

});
