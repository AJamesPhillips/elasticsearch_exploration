
Run:

    yarn
    node index.js

The ES index stats, when running with small values of `ITEM_COUNT*` variables in
index.js, often takes a while to update.
You can try fetching these stats values by running the script again with `node index.js someotherarg`.
Eventually the numbers will update from the initial index size (before documents
were inserted) of ~1165 bytes to something greater.
Note the JSON output subtracts 1165 from the final result but the other logging
does not hence the discrepancy.
