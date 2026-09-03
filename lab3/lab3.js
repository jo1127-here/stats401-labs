d3.csv("../data/lab3_data.csv").then(function(data) {

    const columns = ["title", "price", "rating", "page"];

    let ascending = true;

    const table = d3.select("#table-container")
        .append("table");

    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Create header
    const headerRow = thead.append("tr");

    // No. column
    headerRow.append("th")
        .text("No.");

    // Other columns
    columns.forEach(function(column) {

        headerRow.append("th")
            .text(column)
            .style("cursor", "pointer")
            .on("click", function() {

                data.sort(function(a, b) {

                    let valueA = a[column];
                    let valueB = b[column];

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
    });

    // Update table
    function updateTable() {

        tbody.selectAll("tr").remove();

        data.forEach(function(row, i) {

            const tr = tbody.append("tr");

            // No.
            tr.append("td")
                .text(i + 1);

            // Data
            columns.forEach(function(column) {

                tr.append("td")
                    .text(row[column]);

            });
        });
    }

    // Display table
    updateTable();

}).catch(function(error) {

    console.error("Error loading CSV:", error);

    d3.select("#table-container")
        .append("p")
        .text("Error loading dataset.");

});
