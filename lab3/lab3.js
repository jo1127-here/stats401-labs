d3.csv("../data/lab3_data.csv").then(function(data) {

    const columns = ["title", "price", "rating", "page"];

    let ascending = true;

    const table = d3.select("#table-container")
        .append("table");

    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Create column headings
    const headerRow = thead.append("tr");

    headerRow.selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(function(d) {
            return d;
        })
        .on("click", function(event, column) {

            data.sort(function(a, b) {

                let valueA = a[column];
                let valueB = b[column];

                if (column === "price" || column === "page") {
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

    function updateTable() {

        tbody.selectAll("tr").remove();

        const rows = tbody.selectAll("tr")
            .data(data)
            .enter()
            .append("tr");

        rows.selectAll("td")
            .data(function(row) {
                return columns.map(function(column) {
                    return row[column];
                });
            })
            .enter()
            .append("td")
            .text(function(d) {
                return d;
            });
    }

    updateTable();

}).catch(function(error) {

    console.error("Error loading CSV:", error);

    d3.select("#table-container")
        .append("p")
        .text("Error loading dataset.");

});
                if (valueA > valueB) {
                    return ascending ? 1 : -1;
                }

                return 0;
            });

            ascending = !ascending;

            updateTable();
        });

    function updateTable() {

        tbody.selectAll("tr").remove();

        const rows = tbody.selectAll("tr")
            .data(data)
            .enter()
            .append("tr");

        rows.selectAll("td")
            .data(function(row) {
                return columns.map(function(column) {
                    return row[column];
                });
            })
            .enter()
            .append("td")
            .text(function(d) {
                return d;
            });
    }

    updateTable();

});
