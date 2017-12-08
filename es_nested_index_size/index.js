const elasticsearch = require('elasticsearch')
const fetch = require('node-fetch')

const NESTED_FIELDS = {
    DEEP: 'DEEP',
    SHALLOW: 'SHALLOW',
    NONE: 'NONE',
}

const INDEX = {
    DEEP_NESTED: 'customers-deep-nested',
    SHALLOW_NESTED: 'customers-shallow-nested',
    NO_NESTED: 'customers-no-nesting',
}

const indicesToMake = [
    {
        index: INDEX.DEEP_NESTED,
        nestedFields: NESTED_FIELDS.DEEP,
        sizes: {},
    },
    {
        index: INDEX.SHALLOW_NESTED,
        nestedFields: NESTED_FIELDS.SHALLOW,
        sizes: {},
    },
    {
        index: INDEX.NO_NESTED,
        nestedFields: NESTED_FIELDS.NONE,
        sizes: {},
    },
]

const ITEM_COUNT = 100
const ITEM_COUNT_A_SHALLOW = 10
const ITEM_COUNT_B_SHALLOW = 10
const ITEM_COUNT_A_DEEP = 10
const ITEM_COUNT_B_DEEP = 10

const mappings = (documentType, nestedFields) => {
    const mapping = {
        [documentType]: {
            dynamic: 'strict',
            properties: {
                name: {
                    type: 'text'
                },
                orders: {
                    type: 'nested',
                    properties: {
                        id: {
                            type: 'long'
                        },
                        orderTotal: {
                            type: 'long'
                        },
                        orderStatus: {
                            type: 'text'
                        },
                        orderLines: {
                            type: 'nested',
                            properties: {
                                name: {
                                    type: 'text'
                                },
                                containsAllergen: {
                                    type: 'boolean'
                                }
                            }
                        }
                    }
                },
                favouriteOrders: {
                    type: 'nested',
                    properties: {
                        name: {
                            type: 'text'
                        },
                        numberOrdered: {
                            type: 'long'
                        },
                        allergenInfo: {
                            type: 'nested',
                            properties: {
                                allergenName: {
                                    type: 'text'
                                },
                                allergenScore: {
                                    type: 'long'
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const tmp = mapping[documentType].properties
    if (nestedFields === NESTED_FIELDS.NONE || nestedFields === NESTED_FIELDS.SHALLOW) {
        delete tmp.orders.properties.orderLines.type
        delete tmp.favouriteOrders.properties.allergenInfo.type
    }
    if (nestedFields === NESTED_FIELDS.NONE) {
        delete tmp.orders.type
        delete tmp.favouriteOrders.type
    }

    return mapping
}

async function createIndices(client) {
    const indicesInExistance = await client.cat.indices({ format: 'json' })
    for(let i = 0; i < indicesToMake.length; ++i) {
        const idx = indicesToMake[i]
        const index = idx.index
        const testIndex = indicesInExistance.filter(idx2 => idx2.index === index)

        if (testIndex.length) {
            await client.indices.delete({ index })
        }

        client.indices.create({
            index,
            body: { mappings: mappings(idx.index, idx.nestedFields) }
        })
    }
}

async function reportInitialIndexSize(client) {
    const result = await client.indices.stats()
    for(let i = 0; i < indicesToMake.length; ++i) {
        const idx = indicesToMake[i]
        const index = idx.index
        const stats = result.indices[index]
        idx.sizes.initial = {
            total_store_size_in_bytes: stats.total.store.size_in_bytes,
            primaries_store_size_in_bytes: stats.primaries.store.size_in_bytes
        }

        const l = console.log
        l(`Index: ${index}`)
        l(`primaries.store.size_in_bytes ${idx.sizes.initial.primaries_store_size_in_bytes}`)
        l(`total.store.size_in_bytes ${idx.sizes.initial.total_store_size_in_bytes}`)
        l()
    }
}

async function jsonPrintOut(client) {
    const result = await client.indices.stats()
    const usualInitialSize = 1165
    const no_nested = result.indices[INDEX.NO_NESTED].primaries.store.size_in_bytes - usualInitialSize
    const shallow_nested = result.indices[INDEX.SHALLOW_NESTED].primaries.store.size_in_bytes - usualInitialSize
    const deep_nested = result.indices[INDEX.DEEP_NESTED].primaries.store.size_in_bytes - usualInitialSize
    console.log(`{'item_count':  ${ITEM_COUNT}, 'item_count_a_shallow':   ${ITEM_COUNT_A_SHALLOW}, 'item_count_a_deep':   ${ITEM_COUNT_A_DEEP}, 'item_count_b_shallow':   ${ITEM_COUNT_B_SHALLOW}, 'item_count_b_deep':   ${ITEM_COUNT_B_DEEP}, 'no_nested':   ${no_nested}, 'shallow_nested':   ${shallow_nested}, 'deep_nested':   ${deep_nested}},`)
}

async function reportFilledIndexSize(client) {
    const result = await client.indices.stats()
    for(let i = 0; i < indicesToMake.length; ++i) {
        const idx = indicesToMake[i]
        const index = idx.index
        const stats = result.indices[index]
        const filledPrimariesSize = stats.total.store.size_in_bytes
        const filledTotalSize = stats.primaries.store.size_in_bytes
        idx.sizes.filled = {
            total_store_size_in_bytes: filledPrimariesSize,
            primaries_store_size_in_bytes: filledTotalSize
        }

        const initial = idx.sizes.initial
        let original = initial.primaries_store_size_in_bytes
        const primariesSizePercentage = Math.round(((filledPrimariesSize - original) / original) * 100)
        original = initial.total_store_size_in_bytes
        const totalSizePercentage = Math.round(((filledTotalSize - original) / original) * 100)

        const l = console.log
        l(`Index: ${index}`)
        l(`primaries.store.size_in_bytes ${filledPrimariesSize}   ${filledPrimariesSize - original}   ${primariesSizePercentage}%`)
        l(`total.store.size_in_bytes ${filledTotalSize}   ${filledTotalSize - original}   ${totalSizePercentage}%`)
        l()
    }
}

function generateOrderLines(idx, docNum, orderLineNum) {
    const data = []
    for(let i = 1; i <= ITEM_COUNT_A_DEEP; ++i) {
        data.push({
            name: `orderLines name ${idx.index} ${docNum} ${orderLineNum} ${i}`,
            containsAllergen: i % 2 === 0
        })
    }
    return data
}

function generateOrders(idx, docNum) {
    const data = []
    for(let i = 1; i <= ITEM_COUNT_A_SHALLOW; ++i) {
        data.push({
            id: i,
            orderTotal: i,
            orderStatus: i % 2 === 0 ? 'completed' : 'pending',
            orderLines: generateOrderLines(idx, docNum, i)
        })
    }
    return data
}

function generateAllergenInfo(idx, docNum, favouriteOrderNum) {
    const data = []
    for(let i = 1; i <= ITEM_COUNT_B_DEEP; ++i) {
        data.push({
            allergenName: `allergenName ${idx.index} ${docNum} ${favouriteOrderNum} ${i}`,
            allergenScore: i,
        })
    }
    return data
}

function generateFavouriteOrders(idx, docNum) {
    const data = []
    for(let i = 1; i <= ITEM_COUNT_B_SHALLOW; ++i) {
        data.push({
            name: `favouriteOrder name ${idx.index} ${docNum} ${i}`,
            numberOrdered: i,
            allergenInfo: generateAllergenInfo(idx, docNum, i)
        })
    }
    return data
}

function generateData(idx) {
    const indexName = idx.index
    const data = []
    for(let i = 1; i <= ITEM_COUNT; ++i) {
        data.push({ index:  { _index: indexName, _type: indexName, _id: i } })
        data.push({
            name: `Alex ${indexName} ${i}`,
            orders: generateOrders(idx, i),
            favouriteOrders: generateFavouriteOrders(idx, i)
        })
        if (i % 20 === 0) console.log(`generating ${idx.index} document ${i}`)
    }
    return data
}

async function addData(client) {
    for(let i = 0; i < indicesToMake.length; ++i) {
        const idx = indicesToMake[i]
        const data = generateData(idx)
        await client.bulk({
            refresh: 'wait_for',
            body: data
        })
    }
}

async function flushOrSomething(client) {
    for(let i = 0; i < indicesToMake.length; ++i) {
        const idx = indicesToMake[i]
        await client.indices.flush({ force: true, index: '_all' })
        const results = await client.search({ index: idx.index })
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
}

async function main(client) {

    await createIndices(client)
    await flushOrSomething(client)
    await reportInitialIndexSize(client)
    await addData(client)
    await flushOrSomething(client)
    await reportFilledIndexSize(client)
    await jsonPrintOut(client)
    // const diffClient = { indices: { stats: function () {
    //     return fetch('http://elasticsearch:9600/_all/_stats')
    //     .then(response => response.json())
    // }
    // }}
    // await reportFilledIndexSize(diffClient)
}

const client = new elasticsearch.Client({
    host: 'localhost:9600',
    // log: 'trace'
})

if (process.argv.length === 2) {
    console.log('recreating indices and adding data\n')
    main(client)
} else {
    console.log('report new size\n')
    reportInitialIndexSize(client)
    .then(() => {
        return jsonPrintOut(client)
    })
}


// client.indices.create({
//     index,
// })

// client.indices.putMapping({
//     updateAllTypes: true,
//     index,
//     type: documentType,
//     body: mapping
// })

// client.ping({
//     requestTimeout: 30000,
// }, function (error) {
//     if (error) {
//         console.error('elasticsearch cluster is down!')
//     } else {
//         console.log('All is well')
//     }
// })

// client.search({
//     q: 'pants'
// }).then(function (body) {
//     var hits = body.hits.hits
//     console.log('hits...', hits)
// }, function (error) {
//     console.trace(error.message)
// })
