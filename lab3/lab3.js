d3.csv("../data/lab3_data.csv").then(function(data) {

    const columns = ["title", "price", "rating", "page"];

    let ascending = true;

    const table = d3.select("#table-container")
        .append("table");

    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Create column headings
    const headerRow = thead.append("tr");

    // Row number heading
    headerRow.append("th")
        .text("No.");

    // Data column headings
    headerRow.selectAll("th.data-header")
        .data(columns)
        .enter()
        .append("th")
        .attr("class", "data-header")
        .text(function(column) {
            return column;
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

            // Switch sorting direction
            ascending = !ascending;

            updateTable();
        });

    // Update table
    function updateTable() {

        // Remove old rows
        tbody.selectAll("tr").remove();

        // Create new rows
        const rows = tbody.selectAll("tr")
            .data(data)
            .enter()
            .append("tr");

        // Add row numbers
        rows.append("td")
            .text(function(row, index) {
                return index + 1;
            });

        // Add data
        rows.selectAll("td.data-cell")
            .data(function(row) {
                return columns.map(function(column) {
                    return row[column];
                });
            })
            .enter()
            .append("td")
            .attr("class", "data-cell")
            .text(function(value) {
                return value;
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
```
