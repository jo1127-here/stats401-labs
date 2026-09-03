d3.csv("../data/lab3_data.csv").then(function(data) {

    const columns = ["title", "price", "rating", "page"];

    let ascending = true;

    const table = d3.select("#table-container")
        .append("table");

    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Create column headings
    const headerRow = thead.append("tr");

    // Add No. heading
    headerRow.append("th")
        .text("No.");

    // Add other headings
    headerRow.selectAll("th.data-header")
        .data(columns)
        .enter()
        .append("th")
        .attr("class", "data-header")
        .text(function(d) {
            return d;
        })
        .style("cursor", "pointer")
        .on("click", function(event, column) {

            data.sort(function(a, b) {

                let valueA = a[column];
                let valueB = b[column];

                // Convert numeric columns to numbers
                if (column === "price" ||
                    column === "rating" ||
                    column === "page") {

                    valueA = Number(valueA);
                    valueB = Number(valueB);
                }

                if (valueA < valueB) {
                    return ascending ? -1 : 1;
                }

                if (valueA > valueB) {
                    return ascending ? 1 : -1;
                }

                return 0;
            });

            ascending = !ascending;

            updateTable();
        });

    // Update table rows
    function updateTable() {

        tbody.selectAll("tr").remove();

        const rows = tbody.selectAll("tr")
            .data(data)
            .enter()
            .append("tr");

        // Add row number
        rows.append("td")
            .text(function(d, i) {
                return i + 1;
            });

        // Add data
        rows.selectAll("td.data")
            .data(function(row) {
                return columns.map(function(column) {
                    return row[column];
                });
            })
            .enter()
            .append("td")
            .attr("class", "data")
            .text(function(d) {
                return d;
            });
    }

    // Display table initially
    updateTable();

}).catch(function(error) {

    console.error("Error loading CSV:", error);

    d3.select("#table-container")
        .append("p")
        .text("Error loading dataset.");

});
