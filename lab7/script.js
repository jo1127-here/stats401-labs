// =====================================================
// Basic settings
// =====================================================

const width = 1100;
const height = 650;

const svg = d3.select("#network");

const tooltip = d3.select("#tooltip");


// =====================================================
// Groups
// =====================================================

const linkGroup = svg
    .append("g")
    .attr("class", "links");

const nodeGroup = svg
    .append("g")
    .attr("class", "nodes");


// =====================================================
// Sector colors
// =====================================================

const sectorColors = {
    Manufacturing: "#4e79a7",
    Logistics: "#f28e2c",
    Retail: "#e15759",
    Food: "#59a14f",
    Technology: "#76b7b2",
    Wholesale: "#b07aa1",
    Materials: "#9c755f"
};

const color = d3.scaleOrdinal()
    .domain(Object.keys(sectorColors))
    .range(Object.values(sectorColors));


// =====================================================
// Load data
// =====================================================

Promise.all([

    d3.csv("../data/lab7_assignment_companies.csv"),

    d3.csv("../data/lab7_assignment_transactions_60days.csv")

])
.then(([companies, transactions]) => {

    console.log("Companies:", companies);
    console.log("Transactions:", transactions);

    initialize(
        companies,
        transactions
    );

})
.catch(error => {

    console.error("Error loading data:", error);

});


// =====================================================
// Main initialization
// =====================================================

function initialize(companies, transactions) {


    // =================================================
    // Convert transaction data
    // =================================================

    transactions.forEach(d => {

        d.day = +d.day;

        d.amount_usd = +d.amount_usd;

        d.transaction_count =
            +d.transaction_count;

    });


    // =================================================
    // Convert company IDs
    // =================================================

    companies.forEach(d => {

        d.id = String(d.id);

        d.currentVolume = 0;

    });


    // =================================================
    // Scales
    // =================================================

    const maxAmount = d3.max(
        transactions,
        d => d.amount_usd
    );


    const maxDailyVolume = d3.max(
        transactions,
        d => d.amount_usd
    );


    // Node size
    const nodeSize = d3.scaleSqrt()
        .domain([0, maxDailyVolume])
        .range([7, 26]);


    // Link width
    const linkSize = d3.scaleLinear()
        .domain([0, maxAmount])
        .range([1.5, 7]);


    // =================================================
    // Force simulation
    // =================================================

    const simulation = d3.forceSimulation(companies)

        .force(
            "link",
            d3.forceLink()
                .id(d => d.id)
                .distance(115)
                .strength(0.65)
        )

        .force(
            "charge",
            d3.forceManyBody()
                .strength(-300)
        )

        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )

        .force(
            "x",
            d3.forceX(width / 2)
                .strength(0.035)
        )

        .force(
            "y",
            d3.forceY(height / 2)
                .strength(0.035)
        )

        .force(
            "collision",
            d3.forceCollide()
                .radius(32)
        );


    // =================================================
    // Create nodes ONCE
    // =================================================

    const node = nodeGroup
        .selectAll("circle")
        .data(
            companies,
            d => d.id
        )
        .join("circle")

        .attr(
            "class",
            "node"
        )

        .attr(
            "fill",
            d => sectorColors[d.sector] || "#999"
        )

        .attr(
            "r",
            7
        )

        .on(
            "mouseover",
            nodeMouseover
        )

        .on(
            "mousemove",
            moveTooltip
        )

        .on(
            "mouseout",
            hideTooltip
        )

        .call(
            d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
        );


    // =================================================
    // Simulation tick
    // =================================================

    simulation.on("tick", () => {

        companies.forEach(d => {

            const radius =
                d.currentVolume > 0
                    ? nodeSize(d.currentVolume)
                    : 7;


            // Safe boundaries

            const left =
                radius + 20;

            const right =
                width - radius - 20;

            const top =
                radius + 20;

            const bottom =
                height - radius - 20;


            d.x = Math.max(
                left,
                Math.min(right, d.x)
            );


            d.y = Math.max(
                top,
                Math.min(bottom, d.y)
            );

        });


        // Update links

        linkGroup
            .selectAll("line")
            .attr(
                "x1",
                d => d.source.x
            )
            .attr(
                "y1",
                d => d.source.y
            )
            .attr(
                "x2",
                d => d.target.x
            )
            .attr(
                "y2",
                d => d.target.y
            );


        // Update nodes

        node
            .attr(
                "cx",
                d => d.x
            )
            .attr(
                "cy",
                d => d.y
            );

    });


    // =================================================
    // Current day
    // =================================================

    let currentDay = 1;

    let timer = null;


    // =================================================
    // Show day
    // =================================================

    function showDay(day) {

        currentDay = day;


        // =================================================
        // Transactions for current day
        // =================================================

        const dayTransactions =
            transactions.filter(
                d => d.day === day
            );


        // =================================================
        // Aggregate links
        // =================================================

        const linkMap = new Map();


        dayTransactions.forEach(d => {

            const source =
                String(d.source);

            const target =
                String(d.target);


            const key =
                [source, target]
                    .sort()
                    .join("-");


            if (!linkMap.has(key)) {

                linkMap.set(
                    key,
                    {
                        source: source,
                        target: target,
                        amount_usd: 0,
                        transaction_count: 0,
                        transaction_type:
                            d.transaction_type
                    }
                );

            }


            const link =
                linkMap.get(key);


            link.amount_usd +=
                d.amount_usd;


            link.transaction_count +=
                d.transaction_count;

        });


        const links =
            Array.from(
                linkMap.values()
            );


        // =================================================
        // Calculate company volume
        // =================================================

        const volumeMap = new Map();


        companies.forEach(c => {

            volumeMap.set(
                c.id,
                0
            );

        });


        links.forEach(d => {

            volumeMap.set(
                d.source,
                volumeMap.get(d.source)
                    + d.amount_usd
            );


            volumeMap.set(
                d.target,
                volumeMap.get(d.target)
                    + d.amount_usd
            );

        });


        companies.forEach(c => {

            c.currentVolume =
                volumeMap.get(c.id) || 0;

        });


        // =================================================
        // Update node sizes
        // =================================================

        node
            .transition()
            .duration(400)
            .attr(
                "r",
                d => {

                    if (
                        d.currentVolume === 0
                    ) {
                        return 7;
                    }

                    return nodeSize(
                        d.currentVolume
                    );

                }
            );


        // =================================================
        // Update links
        // =================================================

        const linksSelection =
            linkGroup
                .selectAll("line")
                .data(
                    links,
                    d =>
                        [d.source, d.target]
                            .sort()
                            .join("-")
                );


        linksSelection.join(

            // -----------------------------------------
            // ENTER
            // -----------------------------------------

            enter => {

                return enter
                    .append("line")

                    .attr(
                        "class",
                        "link"
                    )

                    .attr(
                        "stroke-width",
                        0
                    )

                    .attr(
                        "opacity",
                        0
                    )

                    .on(
                        "mouseover",
                        linkMouseover
                    )

                    .on(
                        "mousemove",
                        moveTooltip
                    )

                    .on(
                        "mouseout",
                        hideTooltip
                    )

                    .call(
                        enter =>
                            enter
                                .transition()
                                .duration(400)

                                .attr(
                                    "stroke-width",
                                    d =>
                                        linkSize(
                                            d.amount_usd
                                        )
                                )

                                .attr(
                                    "opacity",
                                    0.7
                                )
                    );

            },


            // -----------------------------------------
            // UPDATE
            // -----------------------------------------

            update => {

                return update
                    .transition()
                    .duration(400)

                    .attr(
                        "stroke-width",
                        d =>
                            linkSize(
                                d.amount_usd
                            )
                    )

                    .attr(
                        "opacity",
                        0.7
                    );

            },


            // -----------------------------------------
            // EXIT
            // -----------------------------------------

            exit => {

                return exit
                    .transition()
                    .duration(400)

                    .attr(
                        "opacity",
                        0
                    )

                    .remove();

            }

        );


        // =================================================
        // Update force links
        // =================================================

        simulation
            .force("link")
            .links(links);


        // =================================================
        // Restart gently
        // =================================================

        simulation
            .alpha(0.15)
            .restart();


        // =================================================
        // Date
        // =================================================

        const dateRecord =
            dayTransactions[0];


        if (dateRecord) {

            d3.select("#day-label")
                .text(
                    `Day ${day} | ${dateRecord.date}`
                );

        }
        else {

            d3.select("#day-label")
                .text(
                    `Day ${day}`
                );

        }


        // =================================================
        // Summary
        // =================================================

        const activeCompanies =
            new Set();


        links.forEach(d => {

            activeCompanies.add(
                d.source
            );

            activeCompanies.add(
                d.target
            );

        });


        const totalValue =
            d3.sum(
                links,
                d => d.amount_usd
            );


        d3.select("#active-companies")
            .text(
                activeCompanies.size
            );


        d3.select("#active-links")
            .text(
                links.length
            );


        d3.select("#total-value")
            .text(
                "$" +
                d3.format(",.0f")(
                    totalValue
                )
            );

    }


    // =================================================
    // Node tooltip
    // =================================================

    function nodeMouseover(event, d) {

        tooltip
            .style("opacity", 1)

            .html(`

                <strong>
                    ${d.company_name}
                </strong>

                <br>

                ID: ${d.id}

                <br>

                Sector: ${d.sector}

                <br>

                Region: ${d.region}

                <br>

                Current transaction volume:
                $${d3.format(",.0f")(
                    d.currentVolume
                )}

            `);

    }


    // =================================================
    // Link tooltip
    // =================================================

    function linkMouseover(event, d) {

        const source =
            getCompany(d.source);

        const target =
            getCompany(d.target);


        tooltip
            .style("opacity", 1)

            .html(`

                <strong>
                    ${source.company_name}
                </strong>

                ↔

                <strong>
                    ${target.company_name}
                </strong>

                <br>

                Type:
                ${d.transaction_type}

                <br>

                Transaction value:
                $${d3.format(",.2f")(
                    d.amount_usd
                )}

                <br>

                Transaction count:
                ${d.transaction_count}

            `);

    }


    // =================================================
    // Get company
    // =================================================

    function getCompany(value) {

        if (
            typeof value === "object"
        ) {

            return value;

        }


        return companies.find(
            c => c.id === String(value)
        );

    }


    // =================================================
    // Tooltip movement
    // =================================================

    function moveTooltip(event) {

        tooltip
            .style(
                "left",
                `${event.clientX + 15}px`
            )

            .style(
                "top",
                `${event.clientY + 15}px`
            );

    }


    // =================================================
    // Hide tooltip
    // =================================================

    function hideTooltip() {

        tooltip
            .style(
                "opacity",
                0
            );

    }


    // =================================================
    // Drag start
    // =================================================

    function dragStarted(event, d) {

        if (!event.active) {

            simulation
                .alphaTarget(0.2)
                .restart();

        }


        d.fx = d.x;
        d.fy = d.y;

    }


    // =================================================
    // Drag
    // =================================================

    function dragged(event, d) {

        d.fx = Math.max(
            25,
            Math.min(
                width - 25,
                event.x
            )
        );


        d.fy = Math.max(
            25,
            Math.min(
                height - 25,
                event.y
            )
        );

    }


    // =================================================
    // Drag end
    // =================================================

    function dragEnded(event, d) {

        if (!event.active) {

            simulation
                .alphaTarget(0);

        }


        d.fx = null;
        d.fy = null;

    }


    // =================================================
    // Play
    // =================================================

    function play() {

        if (timer) {
            return;
        }


        timer = d3.interval(

            () => {

                showDay(currentDay);


                if (currentDay < 60) {

                    currentDay++;

                    d3.select("#time-slider")
                        .property(
                            "value",
                            currentDay
                        );

                }
                else {

                    pause();

                }

            },

            1000

        );

    }


    // =================================================
    // Pause
    // =================================================

    function pause() {

        if (timer) {

            timer.stop();

            timer = null;

        }

    }


    // =================================================
    // Reset
    // =================================================

    function reset() {

        pause();

        currentDay = 1;


        d3.select("#time-slider")
            .property(
                "value",
                1
            );


        showDay(1);

    }


    // =================================================
    // Buttons
    // =================================================

    d3.select("#play")
        .on("click", play);


    d3.select("#pause")
        .on("click", pause);


    d3.select("#reset")
        .on("click", reset);


    // =================================================
    // Slider
    // =================================================

    d3.select("#time-slider")
        .on(
            "input",
            function() {

                pause();

                currentDay =
                    +this.value;

                showDay(currentDay);

            }
        );


    // =================================================
    // Initial display
    // =================================================

    showDay(1);

}
