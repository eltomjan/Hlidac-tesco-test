const express = require('express');
const fs = require('fs');
const app = express();

exports.tesco = require("./tescoProxy2");

async function downloadRest(store)
{
  const file = `data/latest-canonical.${store}.compressed.json`;
  console.error(file);
  const response = await fetch(`https://www.hlidacsupermarketu.cz/${file}`);
  const text = await response.text();
  console.error(`${file} download size ${text.length}`);
  fs.writeFileSync(`output/${file}`, text);
}

async function load()
{
  console.error(`Tesco load`);
  let res = await fetch("https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/all", {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Microsoft Edge\";v=\"120\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1"
    },
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET"
  });
  console.error(`Tesco fetch finished`);
  txt = await res.text();
  console.error(`Tesco text ${txt.length} B`);
  console.error(`Tesco text ${txt}`);
  exports.tesco.fetchData();
  // for (store of ["lidl", "billa", "penny", "dm", "albert", "globus", /*"tesco",*/ "kaufland"])
  //   downloadRest(store);
}

app.use(express.static("output"));

app.listen(80);

module.exports = app;

load();
