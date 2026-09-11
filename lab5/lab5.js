const width = 750;
const height = 550;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const tooltip = d3.select("#tooltip");


Promise.all([
    d3.csv("../data/lab5_assignment_stations.csv", d => ({
        id: d.id,
        station_name: d.station_name,
        district: d.district,
        daily_passengers: +d.daily_passengers,
        station_type: d.station_type
    })),

    d3.csv("../data/lab5_assignment_routes.csv", d => ({
        source: d.source,
        target: d.target,
        travel_time_min: +d.travel_time_min,
        route_type: d.route_type
    }))
])

.then(([nodes, links]) => {

    /*
    --------------------------------
    1. SCALES
    --------------------------------
    */

    const districts = Array.from(
        new Set(nodes.map(d => d.district))
    );

    const districtColor = d3.scaleOrdinal()
        .domain(districts)
        .range(d3.schemeTableau10);


    const passengerSize = d3.scaleSqrt()
        .domain(
            d3.extent(nodes, d => d.daily_passengers)
        )
        .range([5, 16]);


    const travelWidth = d3.scaleLinear()
        .domain(
            d3.extent(links, d => d.travel_time_min)
        )
        .range([1, 5]);


    const routeTypes = Array.from(
        new Set(links.map(d => d.route_type))
    );

    const routeColor = d3.scaleOrdinal()
        .domain(routeTypes)
        .range(d3.schemeSet2);


    /*
    --------------------------------
    2. FORCE SIMULATION
    --------------------------------
    */

    const simulation = d3.forceSimulation(nodes)
        .force("link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(80)
        )
        .force("charge",
            d3.forceManyBody()
                .strength(-120)
        )
        .force("center",
            d3.forceCenter(width / 2, height / 2)
        )
        .force("collision",
            d3.forceCollide()
                .radius(d => passengerSize(d.daily_passengers) + 3)
        );


    // 下面继续接你原来的代码
