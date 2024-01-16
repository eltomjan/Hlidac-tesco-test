const parser = require("node-html-parser");
//const utils = require("./utils");
const proxy = require('https-proxy-agent');
const proxyHost = '104.129.207.9';
const proxyPort = 10200;
const fs = require("fs");

const units = {
    kus: { unit: "kus", factor: 1 },
};

exports.getCanonical = function (item, today) {
    item.priceHistory = [{ date: today, price: item.price }];
    return utils.convertUnit(item, units, "tesco");
};

function roundNum(num, decimalExp = [1000, 100]) {
    if (num > 1) return Math.round(num * decimalExp[1]) / decimalExp[1];
    return Math.round(num * decimalExp[0]) / decimalExp[0];
}
exports.fetchData = async function () {
    const settings = {
        blockOfPages: 48,
        bio: "bio",
        bioMiddle: " bio ",
        scriptJSON: "script",
        rawMarks: ["data-redux-state"]
    };
    let headers = { cookie: [] };
    async function firstGet(fetchOpts, Url) {
        let res = undefined;
        console.log(`Tesco ${Url} ${JSON.stringify(fetchOpts).substr(0, 100)}...`);
        await fetch(Url, fetchOpts).then((response) => {
            res = response;
            for (const pair of response.headers) {
                // console.log(`all ${pair[0]}:${pair[1]}`);
                if (pair[0] == "content-length") continue;
                if (pair[0] == "set-cookie") {
                    headers.cookie.push(pair[1].split(";")[0]);
                } else {
                    headers[pair[0]] = pair[1];
                }
            }
        });
        fetchOpts.headers.cookie = headers.cookie.join("; ");
        console.log(`Tesco cookies:${fetchOpts.headers.cookie.substr(0, 100)}`);
        headers.cookie = [];
        txt = await res.text();
        console.log(`Tesco firstGet content (${txt.length}) ${txt.substring(0, 300)}...`);
        let magics = parser.parse(txt.substring(txt.indexOf("<html")), {
            lowerCaseTagName: true, // convert tag name to lower case (hurts performance heavily)
            comment: false, // retrieve comments (hurts performance slightly)
            blockTextElements: {
                script: true,
                noscript: false,
                style: true,
                pre: false,
            },
        });
        let scripts = magics.getElementsByTagName("script");
        console.log(
            `Tesco firstGet ${scripts.length} scripts / last ${scripts[scripts.length - 1].outerHTML.substr(0, 1500)}\n=======\n${scripts[
                scripts.length - 2
            ].outerHTML.substr(0, 100)}`
        ); // real examples 1081, 66
        let body = scripts
            .pop()
            .innerText.match(/(\{"bm-verify":.+:\s+)j\}\)/)
            .pop();
        let mth = scripts.pop().innerText.match(/(\d+)/g);
        let j = Number(mth[0]) + Number(mth[1] + mth[2]);
        body += j + "}";
        // fetchOpts.headers["content-type"] = "application/json";
        // fetchOpts.headers["sec-fetch-dest"] = "empty";
        // fetchOpts.headers["sec-fetch-mode"] = "cors";
        delete fetchOpts.headers["sec-fetch-user"];
        fetchOpts.headers.Referer = Url;
        fetchOpts.body = body;
        fetchOpts.method = "POST";
        console.log(`Tesco firstGet POST https://nakup.itesco.cz/_sec/verify?provider=interstitial ${JSON.stringify(fetchOpts).substr(0, 100)}...`);
        res = await fetch("https://nakup.itesco.cz/_sec/verify?provider=interstitial", fetchOpts).then((response) => {
            for (const pair of response.headers) {
                // console.log(`provider ${pair[0]}:${pair[1]}`);
                if (pair[0] == "content-length") continue;
                if (pair[0] == "set-cookie") {
                    headers.cookie.push(pair[1].split(";")[0]);
                } else {
                    headers[pair[0]] = pair[1];
                }
            }
        });
        delete fetchOpts.body;

        const cookies = headers.cookie.join("; ");
        console.log(`Tesco firstGet cookies ${cookies}`);
        return cookies;
    }
    let tescoItems = [];

    // Proxy URL
    const proxyUrl = `http://${proxyHost}:${proxyPort}`;

    // Create a new Proxy Agent
    const proxyAgent = new proxy.HttpsProxyAgent(proxyUrl);

    const catRaw = await fetch("https://nakup.itesco.cz/groceries/cs-CZ/taxonomy", { agent: proxyAgent });
    let categories = await catRaw.json();
    const baseUrl = "https://nakup.itesco.cz/groceries/cs-CZ/shop";
    let fetchOpts = {
        agent: proxyAgent,
        headers: {
        //     accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        //     "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
        //     "cache-control": "no-cache",
        //     pragma: "no-cache",
        //     "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
        //     "sec-ch-ua-mobile": "?0",
        //     "sec-ch-ua-platform": '"Windows"',
        //     "sec-fetch-dest": "document",
        //     "sec-fetch-mode": "navigate",
        //     "sec-fetch-site": "same-origin",
        //     "sec-fetch-user": "?1",
        //     "upgrade-insecure-requests": "1",
        //     referrerPolicy: "strict-origin-when-cross-origin",
        },
        // body: null,
    };

    for (let i = 0; i < categories.length; i++) {
        let main = categories[i];
        const cat = main.name;
        let childUrl = main.children[0].url;
        let page = 1,
            pagination;

        const debugEnv = fs.existsSync("stores/tesco");

        do {
            // https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/all (?page=1...)
            const Url = `${baseUrl}${childUrl}?page=${page}&count=${settings.blockOfPages}`;
            console.log(`Tesco ${tescoItems.length} - ${i + 1}. z ${categories.length} ${Url}`);
            if (!tescoItems.length) {
                try {
                    await firstGet(fetchOpts, Url);
                    fetchOpts.headers.cookie = headers.cookie.join("; ");
                    fetchOpts.method = "GET";
                } catch (e) {
                    console.log(`Tesco firstGet ${e}`);
                }
            }

            headers.cookie = [];
            const filePath = `stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`;
            if (debugEnv && fs.existsSync(filePath)) txt = fs.readFileSync(filePath).toString();
            else {
                console.log(`Tesco ${Url} ${JSON.stringify(fetchOpts).substr(0, 100)}...`);
                try {
                    await fetch(Url, fetchOpts).then((response) => {
                        res = response;
                        for (const pair of response.headers) {
                            if (pair[0] == "content-length") continue;
                            if (pair[0] == "set-cookie") {
                                headers.cookie.push(pair[1].split(";")[0]);
                            } else {
                                headers[pair[0]] = pair[1];
                            }
                        }
                    });
                    txt = await res.text();
                    console.log(`Tesco ${Url} got ${txt.length} bytes.`);
                    if (debugEnv) fs.writeFileSync(`stores/tesco/${main.catId}_${(page + 100).toString().substr(1)}.htm`, txt);
                } catch (e) {
                    console.log(`Tesco fetch ${e}`);
                }
            }

            let parseFrom = txt.indexOf(settings.rawMarks[0]) + settings.rawMarks[0].length; // <body ... data-redux-state="{&quot;
            parseFrom = txt.indexOf("=", parseFrom) + 1; // ="{&quot;
            parseFrom = txt.indexOf('"', parseFrom) + 1; // &quot;accountPage
            let parseTo = txt.indexOf('"', parseFrom); // hasLastOrder&quot;:false}}" ...
            pagination = JSON.parse(txt.substring(parseFrom, parseTo).replace(/&quot;/g, '"')).results;
            let items = pagination.pages[page - 1].serializedData;

            console.log(`Tesco ${settings.rawMarks[0]} indexes ${parseFrom}-${parseTo} => ${items.length} items.`);
            try {
                for (let item of items) {
                    if (item == items[0]) console.log(`Tesco ${pagination.pageNo}/${pagination.pages.length} of ${pagination.totalCount}.`);
                    let itemData = item[1].product;
                    itemData = {
                        store: "tesco",
                        id: itemData.id,
                        name: itemData.title,
                        description: item[1].promotions[0]?.offerText || itemData.title,
                        price: itemData.price,
                        priceHistory: [],
                        unit: itemData.unitOfMeasure,
                        quantity: roundNum(itemData.price / itemData.unitPrice),
                        categoryNames: itemData.departmentName,
                    };
                    if (itemData.name.startsWith(settings.bio) || itemData.name.indexOf(settings.bioMiddle) > 0) {
                        itemData.bio = true;
                    }
                    tescoItems.push(itemData);
                    break;
                }
            } catch (e) {
                console.log(`Tesco items ${e}`);
            }
            break;
        } while (pagination.pages.length != page++);
        break;
    }

    return tescoItems;
};

exports.initializeCategoryMapping = async () => {};

exports.mapCategory = (rawItem, item) => {
    if (item.categoryNames) return item.categoryNames;
    return null;
};

// async function run()
// {
//     try {
//         const tescoItems = await exports.fetchData();
//         fs.writeFileSync(`output/tesco.json`, JSON.stringify(tescoItems));
//     } catch (e) {
//         console.log(e);
//     }
//     return tescoItems;
// }
// run()
