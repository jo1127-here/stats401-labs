// =====================================================
// Lab 7
// Temporal Commercial Network
// =====================================================


// =====================================================
// Basic settings
// =====================================================

const width = 1100;
const height = 750;

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

const sectorColor = d3.scaleOrdinal()
    .domain([
        "Manufacturing",
        "Logistics",
        "Retail",
        "Technology",
        "Services"
    ])
    .range(d3.schemeTableau10);


// =====================================================
// Load data
// =====================================================

Promise.all([

    d3.csv(
        "../data/lab7_assignment_companies.csv"
    ),

    d3.csv(
        "../data/lab7_assignment_transactions_60days.csv"
    )

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

    console.error(
        "Error loading data:",
        error
    );

});


// =====================================================
// Main initialization
// =====================================================

function initialize(
    companies,
    transactions
) {


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

    const maxVolume = d3.max(
        transactions,
        d => d.amount_usd
    );


    const nodeSize = d3.scaleSqrt()
        .domain([0, maxVolume])
        .range([6, 35]);


    const linkSize = d3.scaleLinear()
        .domain([0, maxVolume])
        .range([1, 7]);


    // =================================================
    // Force simulation
    // =================================================

    const simulation = d3.forceSimulation(
        companies
    )
        
        .force("x", d3.forceX(width / 2).strength(0.03))
        .force("y", d3.forceY(height / 2).strength(0.03))

        .force(
            "link",
            d3.forceLink()
                .id(d => d.id)
                .distance(130)
                .strength(0.7)
        )

        .force(
            "charge",
            d3.forceManyBody()
                .strength(-400)
        )

        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )

        .force(
            "collision",
            d3.forceCollide()
                .radius(40)
        );


    // =================================================
    // Create nodes ONLY ONCE
    // =================================================

    const node = nodeGroup
        .selectAll("circle")
        .data(
            companies,
            d => d.id
        )
        .join("circle")

        .attr("class", "node")

        .attr(
            "fill",
            d => sectorColor(d.sector)
        )

        .attr(
            "r",
            10
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
                .on(
                    "start",
                    dragStarted
                )
                .on(
                    "drag",
                    dragged
                )
                .on(
                    "end",
                    dragEnded
                )
        );


    // =================================================
    // Simulation tick
    // =================================================

    simulation.on(
        "tick",
        () => {
    
            // Keep nodes inside the visualization
            companies.forEach(d => {
    
                const radius = d.currentVolume > 0
                    ? nodeSize(d.currentVolume)
                    : 6;
    
                d.x = Math.max(
                    radius + 10,
                    Math.min(
                        width - radius - 10,
                        d.x
                    )
                );
    
                d.y = Math.max(
                    radius + 10,
                    Math.min(
                        height - radius - 10,
                        d.y
                    )
                );
    
            });
    
    
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
    
    
            node
                .attr(
                    "cx",
                    d => d.x
                )
                .attr(
                    "cy",
                    d => d.y
                );
    
        }
    );


    // =================================================
    // Current day
    // =================================================

    let currentDay = 1;

    let timer = null;


    // =================================================
    // Show a specific day
    // =================================================

    function showDay(day) {

        currentDay = day;


        // =============================================
        // Get transactions for this day
        // =============================================

        const dayTransactions =
            transactions.filter(
                d => d.day === day
            );


        // =============================================
        // Aggregate company pairs
        // =============================================

        const linkMap = new Map();


        dayTransactions.forEach(d => {

            const source =
                String(d.source);

            const target =
                String(d.target);


            // Undirected relationship

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


        // =============================================
        // Calculate current company volume
        // =============================================

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


        // =============================================
        // Update node size
        // =============================================

        node
            .transition()
            .duration(500)
            .attr(
                "r",
                d => {

                    if (
                        d.currentVolume === 0
                    ) {
                        return 6;
                    }

                    return nodeSize(
                        d.currentVolume
                    );

                }
            );


        // =============================================
        // Update links
        // =============================================

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


        // =============================================
        // New links
        // =============================================

        linksSelection
            .join(

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
                                    .duration(500)
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


                // =====================================
                // Existing links
                // =====================================

                update => {

                    return update
                        .transition()
                        .duration(500)
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


                // =====================================
                // Disappearing links
                // =====================================

                exit => {

                    return exit
                        .transition()
                        .duration(500)
                        .attr(
                            "opacity",
                            0
                        )
                        .remove();

                }

            );


        // =============================================
        // Update simulation links
        // =============================================

        simulation
            .force("link")
            .links(links);


        // =============================================
        // Gently restart simulation
        // =============================================

        simulation
            .alpha(0.2)
            .restart();


        // =============================================
        // Find date
        // =============================================

        const dateRecord =
            dayTransactions[0];


        let dateText =
            `Day ${day}`;


        if (dateRecord) {

            dateText =
                `Day ${day} | ${dateRecord.date}`;

        }


        d3.select("#day-label")
            .text(dateText);


        // =============================================
        // Summary
        // =============================================

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


        d3.select(
            "#active-companies"
        )
            .text(
                activeCompanies.size
            );


        d3.select(
            "#active-links"
        )
            .text(
                links.length
            );


        d3.select(
            "#total-value"
        )
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

    function nodeMouseover(
        event,
        d
    ) {

        tooltip
            .style(
                "opacity",
                1
            )
            .html(`

                <strong>
                    ${d.company_name}
                </strong>

                <br>

                ID:
                ${d.id}

                <br>

                Sector:
                ${d.sector}

                <br>

                Region:
                ${d.region}

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

    function linkMouseover(
        event,
        d
    ) {

        const source =
            getCompany(
                d.source
            );


        const target =
            getCompany(
                d.target
            );


        tooltip
            .style(
                "opacity",
                1
            )
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
    // Find company
    // =================================================

    function getCompany(
        value
    ) {

        if (
            typeof value === "object"
        ) {

            return value;

        }


        return companies.find(
            c => c.id === value
        );

    }


    // =================================================
    // Tooltip movement
    // =================================================

    function moveTooltip(
        event
    ) {

        tooltip
            .style(
                "left",
                `${event.pageX + 12}px`
            )
            .style(
                "top",
                `${event.pageY + 12}px`
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

    function dragStarted(
        event,
        d
    ) {

        if (
            !event.active
        ) {

            simulation
                .alphaTarget(0.2)
                .restart();

        }


        d.fx = d.x;
        d.fy = d.y;

    }


    // =================================================
    // Dragging
    // =================================================

    function dragged(
        event,
        d
    ) {

        d.fx = event.x;
        d.fy = event.y;

    }


    // =================================================
    // Drag end
    // =================================================

    function dragEnded(
        event,
        d
    ) {

        if (
            !event.active
        ) {

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

                showDay(
                    currentDay
                );


                currentDay++;


                if (
                    currentDay > 60
                ) {

                    pause();

                    currentDay = 60;

                }


                d3.select(
                    "#time-slider"
                )
                    .property(
                        "value",
                        currentDay
                    );

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


        d3.select(
            "#time-slider"
        )
            .property(
                "value",
                1
            );


        showDay(1);

    }


    // =================================================
    // Button controls
    // =================================================

    d3.select("#play")
        .on(
            "click",
            play
        );


    d3.select("#pause")
        .on(
            "click",
            pause
        );


    d3.select("#reset")
        .on(
            "click",
            reset
        );


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

                showDay(
                    currentDay
                );

            }
        );


    // =================================================
    // Initial visualization
    // =================================================

    showDay(1);

}
